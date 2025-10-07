(define-constant ERR_UNAUTHORIZED (err u1000))
(define-constant ERR_INVALID_DATA (err u1001))
(define-constant ERR_SENSOR_NOT_REGISTERED (err u1002))
(define-constant ERR_SUBMISSION_FAILED (err u1003))
(define-constant ERR_INVALID_METRICS (err u1004))
(define-constant ERR_INVALID_HASH (err u1005))
(define-constant ERR_DUPLICATE_SUBMISSION (err u1006))
(define-constant ERR_INVALID_FARM_ID (err u1007))
(define-constant ERR_INVALID_SENSOR_ID (err u1008))
(define-constant ERR_REWARD_CLAIM_FAILED (err u1009))
(define-constant ERR_VALIDATION_FAILED (err u1010))
(define-constant ERR_TIMESTAMP_INVALID (err u1011))
(define-constant ERR_ACCESS_DENIED (err u1012))
(define-constant ERR_MAX_SUBMISSIONS_EXCEEDED (err u1013))
(define-constant ERR_INVALID_MOISTURE (err u1014))
(define-constant ERR_INVALID_PH (err u1015))
(define-constant ERR_INVALID_NUTRIENTS (err u1016))
(define-constant ERR_INVALID_TEMPERATURE (err u1017))
(define-constant ERR_ORACLE_NOT_SET (err u1018))
(define-constant ERR_INVALID_REWARD_AMOUNT (err u1019))
(define-constant ERR_INSUFFICIENT_BALANCE (err u1020))

(define-data-var submission-counter uint u0)
(define-data-var max-submissions-per-farm uint u1000)
(define-data-var reward-per-submission uint u10)
(define-data-var oracle-principal (optional principal) none)
(define-data-var total-rewards-claimed uint u0)

(define-map submissions 
  { farm-id: uint, sensor-id: uint, timestamp: uint }
  {
    data-hash: (string-ascii 64),
    metrics: { moisture: uint, ph: uint, nutrients: uint, temperature: uint },
    farmer: principal,
    validated: bool,
    reward-claimed: bool
  }
)

(define-map submission-history 
  uint
  { count: uint, last-timestamp: uint }
)

(define-map farm-submission-counts uint uint)

(define-trait sensor-registry-trait
  ((is-registered (uint) (response bool uint))))

(define-trait data-validation-trait
  ((validate-data ({moisture: uint, ph: uint, nutrients: uint, temperature: uint}) (response bool uint))))

(define-trait token-contract-trait
  ((transfer (uint principal principal) (response bool uint))
   (mint (uint principal) (response bool uint))))

(define-trait alert-system-trait
  ((trigger-alert (uint uint {moisture: uint, ph: uint, nutrients: uint, temperature: uint}) (response bool uint))))

(define-trait analytics-engine-trait
  ((update-analytics (uint {moisture: uint, ph: uint, nutrients: uint, temperature: uint}) (response bool uint))))

(define-public (submit-soil-data 
  (farm-id uint)
  (sensor-id uint)
  (data-hash (string-ascii 64))
  (metrics {moisture: uint, ph: uint, nutrients: uint, temperature: uint})
  (sensor-registry <sensor-registry-trait>)
  (data-validator <data-validation-trait>)
  (token-contract <token-contract-trait>)
  (alert-system <alert-system-trait>)
  (analytics-engine <analytics-engine-trait>))
  (let (
    (current-timestamp block-height)
    (farm-count (default-to u0 (map-get? farm-submission-counts farm-id)))
    (submission-key {farm-id: farm-id, sensor-id: sensor-id, timestamp: current-timestamp})
    (history (default-to {count: u0, last-timestamp: u0} (map-get? submission-history farm-id)))
  )
    (asserts! (> farm-id u0) ERR_INVALID_FARM_ID)
    (asserts! (> sensor-id u0) ERR_INVALID_SENSOR_ID)
    (asserts! (is-eq (len data-hash) u64) ERR_INVALID_HASH)
    (try! (validate-metrics metrics))
    (asserts! (is-some (var-get oracle-principal)) ERR_ORACLE_NOT_SET)
    (asserts! (unwrap! (contract-call? sensor-registry is-registered sensor-id) ERR_SENSOR_NOT_REGISTERED) ERR_SENSOR_NOT_REGISTERED)
    (asserts! (< farm-count (var-get max-submissions-per-farm)) ERR_MAX_SUBMISSIONS_EXCEEDED)
    (asserts! (is-none (map-get? submissions submission-key)) ERR_DUPLICATE_SUBMISSION)
    (asserts! (> current-timestamp (get last-timestamp history)) ERR_TIMESTAMP_INVALID)
    (let ((validation-result (contract-call? data-validator validate-data metrics)))
      (asserts! (is-ok validation-result) ERR_VALIDATION_FAILED)
      (asserts! (unwrap! validation-result ERR_VALIDATION_FAILED) ERR_VALIDATION_FAILED)
    )
    (map-set submissions submission-key
      {
        data-hash: data-hash,
        metrics: metrics,
        farmer: tx-sender,
        validated: true,
        reward-claimed: false
      }
    )
    (map-set farm-submission-counts farm-id (+ farm-count u1))
    (map-set submission-history farm-id {count: (+ (get count history) u1), last-timestamp: current-timestamp})
    (var-set submission-counter (+ (var-get submission-counter) u1))
    (try! (contract-call? analytics-engine update-analytics farm-id metrics))
    (try! (contract-call? alert-system trigger-alert farm-id sensor-id metrics))
    (print { event: "data-submitted", farm-id: farm-id, sensor-id: sensor-id, timestamp: current-timestamp })
    (ok submission-key)
  )
)

(define-public (claim-reward 
  (farm-id uint)
  (sensor-id uint)
  (timestamp uint)
  (token-contract <token-contract-trait>))
  (let (
    (submission-key {farm-id: farm-id, sensor-id: sensor-id, timestamp: timestamp})
    (submission (map-get? submissions submission-key))
  )
    (match submission sub
      (begin
        (asserts! (is-eq (get farmer sub) tx-sender) ERR_UNAUTHORIZED)
        (asserts! (get validated sub) ERR_VALIDATION_FAILED)
        (asserts! (not (get reward-claimed sub)) ERR_REWARD_CLAIM_FAILED)
        (try! (as-contract (contract-call? token-contract mint (var-get reward-per-submission) tx-sender)))
        (map-set submissions submission-key (merge sub {reward-claimed: true}))
        (var-set total-rewards-claimed (+ (var-get total-rewards-claimed) (var-get reward-per-submission)))
        (print { event: "reward-claimed", farm-id: farm-id, sensor-id: sensor-id, timestamp: timestamp })
        (ok true)
      )
      ERR_SUBMISSION_FAILED
    )
  )
)

(define-private (validate-metrics (metrics {moisture: uint, ph: uint, nutrients: uint, temperature: uint}))
  (begin
    (asserts! (and (>= (get moisture metrics) u0) (<= (get moisture metrics) u100)) ERR_INVALID_MOISTURE)
    (asserts! (and (>= (get ph metrics) u0) (<= (get ph metrics) u14)) ERR_INVALID_PH)
    (asserts! (and (>= (get nutrients metrics) u0) (<= (get nutrients metrics) u1000)) ERR_INVALID_NUTRIENTS)
    (asserts! (and (>= (get temperature metrics) u-50) (<= (get temperature metrics) u60)) ERR_INVALID_TEMPERATURE)
    (ok true)
  )
)

(define-public (set-oracle-principal (new-oracle principal))
  (begin
    (asserts! (is-eq tx-sender contract-caller) ERR_UNAUTHORIZED)
    (var-set oracle-principal (some new-oracle))
    (ok true)
  )
)

(define-public (set-max-submissions-per-farm (new-max uint))
  (begin
    (asserts! (is-eq tx-sender contract-caller) ERR_UNAUTHORIZED)
    (asserts! (> new-max u0) ERR_INVALID_UPDATE_PARAM)
    (var-set max-submissions-per-farm new-max)
    (ok true)
  )
)

(define-public (set-reward-per-submission (new-reward uint))
  (begin
    (asserts! (is-eq tx-sender contract-caller) ERR_UNAUTHORIZED)
    (asserts! (> new-reward u0) ERR_INVALID_REWARD_AMOUNT)
    (var-set reward-per-submission new-reward)
    (ok true)
  )
)

(define-read-only (get-submission (farm-id uint) (sensor-id uint) (timestamp uint))
  (map-get? submissions {farm-id: farm-id, sensor-id: sensor-id, timestamp: timestamp})
)

(define-read-only (get-farm-submission-count (farm-id uint))
  (ok (default-to u0 (map-get? farm-submission-counts farm-id)))
)

(define-read-only (get-submission-history (farm-id uint))
  (map-get? submission-history farm-id)
)

(define-read-only (get-total-submissions)
  (ok (var-get submission-counter))
)

(define-read-only (get-total-rewards-claimed)
  (ok (var-get total-rewards-claimed))
)

(define-read-only (get-reward-per-submission)
  (ok (var-get reward-per-submission))
)

(define-read-only (get-max-submissions-per-farm)
  (ok (var-get max-submissions-per-farm))
)

(define-read-only (get-oracle-principal)
  (ok (var-get oracle-principal))
)