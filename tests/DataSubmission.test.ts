import { describe, it, expect, beforeEach } from "vitest";

const ERR_UNAUTHORIZED = 1000;
const ERR_INVALID_DATA = 1001;
const ERR_SENSOR_NOT_REGISTERED = 1002;
const ERR_SUBMISSION_FAILED = 1003;
const ERR_INVALID_METRICS = 1004;
const ERR_INVALID_HASH = 1005;
const ERR_DUPLICATE_SUBMISSION = 1006;
const ERR_INVALID_FARM_ID = 1007;
const ERR_INVALID_SENSOR_ID = 1008;
const ERR_REWARD_CLAIM_FAILED = 1009;
const ERR_VALIDATION_FAILED = 1010;
const ERR_TIMESTAMP_INVALID = 1011;
const ERR_MAX_SUBMISSIONS_EXCEEDED = 1013;
const ERR_INVALID_MOISTURE = 1014;
const ERR_INVALID_PH = 1015;
const ERR_INVALID_NUTRIENTS = 1016;
const ERR_INVALID_TEMPERATURE = 1017;
const ERR_ORACLE_NOT_SET = 1018;
const ERR_INVALID_REWARD_AMOUNT = 1019;

interface Metrics {
  moisture: number;
  ph: number;
  nutrients: number;
  temperature: number;
}

interface Submission {
  dataHash: string;
  metrics: Metrics;
  farmer: string;
  validated: boolean;
  rewardClaimed: boolean;
}

interface SubmissionKey {
  farmId: number;
  sensorId: number;
  timestamp: number;
}

interface SubmissionHistory {
  count: number;
  lastTimestamp: number;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

interface Trait {
  [key: string]: (args: any) => Result<any>;
}

class DataSubmissionMock {
  state: {
    submissionCounter: number;
    maxSubmissionsPerFarm: number;
    rewardPerSubmission: number;
    oraclePrincipal: string | null;
    totalRewardsClaimed: number;
    submissions: Map<string, Submission>;
    submissionHistory: Map<number, SubmissionHistory>;
    farmSubmissionCounts: Map<number, number>;
  } = {
    submissionCounter: 0,
    maxSubmissionsPerFarm: 1000,
    rewardPerSubmission: 10,
    oraclePrincipal: null,
    totalRewardsClaimed: 0,
    submissions: new Map(),
    submissionHistory: new Map(),
    farmSubmissionCounts: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  contractCaller: string = "ST1TEST";

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      submissionCounter: 0,
      maxSubmissionsPerFarm: 1000,
      rewardPerSubmission: 10,
      oraclePrincipal: null,
      totalRewardsClaimed: 0,
      submissions: new Map(),
      submissionHistory: new Map(),
      farmSubmissionCounts: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.contractCaller = "ST1TEST";
  }

  private getKey(key: SubmissionKey): string {
    return `${key.farmId}-${key.sensorId}-${key.timestamp}`;
  }

  submitSoilData(
    farmId: number,
    sensorId: number,
    dataHash: string,
    metrics: Metrics,
    sensorRegistry: Trait,
    dataValidator: Trait,
    tokenContract: Trait,
    alertSystem: Trait,
    analyticsEngine: Trait
  ): Result<SubmissionKey> {
    const currentTimestamp = this.blockHeight;
    const farmCount = this.state.farmSubmissionCounts.get(farmId) ?? 0;
    const submissionKey: SubmissionKey = { farmId, sensorId, timestamp: currentTimestamp };
    const keyStr = this.getKey(submissionKey);
    const history = this.state.submissionHistory.get(farmId) ?? { count: 0, lastTimestamp: 0 };

    if (farmId <= 0) return { ok: false, value: ERR_INVALID_FARM_ID };
    if (sensorId <= 0) return { ok: false, value: ERR_INVALID_SENSOR_ID };
    if (dataHash.length !== 64) return { ok: false, value: ERR_INVALID_HASH };
    if (metrics.moisture < 0 || metrics.moisture > 100) return { ok: false, value: ERR_INVALID_MOISTURE };
    if (metrics.ph < 0 || metrics.ph > 14) return { ok: false, value: ERR_INVALID_PH };
    if (metrics.nutrients < 0 || metrics.nutrients > 1000) return { ok: false, value: ERR_INVALID_NUTRIENTS };
    if (metrics.temperature < -50 || metrics.temperature > 60) return { ok: false, value: ERR_INVALID_TEMPERATURE };
    if (!this.state.oraclePrincipal) return { ok: false, value: ERR_ORACLE_NOT_SET };
    const regResult = sensorRegistry["is-registered"](sensorId);
    if (!regResult.ok || !regResult.value) return { ok: false, value: ERR_SENSOR_NOT_REGISTERED };
    if (farmCount >= this.state.maxSubmissionsPerFarm) return { ok: false, value: ERR_MAX_SUBMISSIONS_EXCEEDED };
    if (this.state.submissions.has(keyStr)) return { ok: false, value: ERR_DUPLICATE_SUBMISSION };
    if (currentTimestamp <= history.lastTimestamp) return { ok: false, value: ERR_TIMESTAMP_INVALID };
    const valResult = dataValidator["validate-data"](metrics);
    if (!valResult.ok || !valResult.value) return { ok: false, value: ERR_VALIDATION_FAILED };

    this.state.submissions.set(keyStr, {
      dataHash,
      metrics,
      farmer: this.caller,
      validated: true,
      rewardClaimed: false,
    });
    this.state.farmSubmissionCounts.set(farmId, farmCount + 1);
    this.state.submissionHistory.set(farmId, { count: history.count + 1, lastTimestamp: currentTimestamp });
    this.state.submissionCounter += 1;
    analyticsEngine["update-analytics"]({ farmId, metrics });
    alertSystem["trigger-alert"]({ farmId, sensorId, metrics });
    return { ok: true, value: submissionKey };
  }

  claimReward(
    farmId: number,
    sensorId: number,
    timestamp: number,
    tokenContract: Trait
  ): Result<boolean> {
    const submissionKey: SubmissionKey = { farmId, sensorId, timestamp };
    const keyStr = this.getKey(submissionKey);
    const submission = this.state.submissions.get(keyStr);
    if (!submission) return { ok: false, value: ERR_SUBMISSION_FAILED };
    if (submission.farmer !== this.caller) return { ok: false, value: ERR_UNAUTHORIZED };
    if (!submission.validated) return { ok: false, value: ERR_VALIDATION_FAILED };
    if (submission.rewardClaimed) return { ok: false, value: ERR_REWARD_CLAIM_FAILED };
    const mintResult = tokenContract["mint"]({ amount: this.state.rewardPerSubmission, to: this.caller });
    if (!mintResult.ok) return { ok: false, value: ERR_REWARD_CLAIM_FAILED };
    this.state.submissions.set(keyStr, { ...submission, rewardClaimed: true });
    this.state.totalRewardsClaimed += this.state.rewardPerSubmission;
    return { ok: true, value: true };
  }

  setOraclePrincipal(newOracle: string): Result<boolean> {
    if (this.caller !== this.contractCaller) return { ok: false, value: ERR_UNAUTHORIZED };
    this.state.oraclePrincipal = newOracle;
    return { ok: true, value: true };
  }

  setMaxSubmissionsPerFarm(newMax: number): Result<boolean> {
    if (this.caller !== this.contractCaller) return { ok: false, value: ERR_UNAUTHORIZED };
    if (newMax <= 0) return { ok: false, value: ERR_INVALID_REWARD_AMOUNT };
    this.state.maxSubmissionsPerFarm = newMax;
    return { ok: true, value: true };
  }

  setRewardPerSubmission(newReward: number): Result<boolean> {
    if (this.caller !== this.contractCaller) return { ok: false, value: ERR_UNAUTHORIZED };
    if (newReward <= 0) return { ok: false, value: ERR_INVALID_REWARD_AMOUNT };
    this.state.rewardPerSubmission = newReward;
    return { ok: true, value: true };
  }

  getSubmission(farmId: number, sensorId: number, timestamp: number): Submission | null {
    const keyStr = this.getKey({ farmId, sensorId, timestamp });
    return this.state.submissions.get(keyStr) ?? null;
  }

  getFarmSubmissionCount(farmId: number): Result<number> {
    return { ok: true, value: this.state.farmSubmissionCounts.get(farmId) ?? 0 };
  }

  getSubmissionHistory(farmId: number): SubmissionHistory | null {
    return this.state.submissionHistory.get(farmId) ?? null;
  }

  getTotalSubmissions(): Result<number> {
    return { ok: true, value: this.state.submissionCounter };
  }

  getTotalRewardsClaimed(): Result<number> {
    return { ok: true, value: this.state.totalRewardsClaimed };
  }

  getRewardPerSubmission(): Result<number> {
    return { ok: true, value: this.state.rewardPerSubmission };
  }

  getMaxSubmissionsPerFarm(): Result<number> {
    return { ok: true, value: this.state.maxSubmissionsPerFarm };
  }

  getOraclePrincipal(): Result<string | null> {
    return { ok: true, value: this.state.oraclePrincipal };
  }
}

describe("DataSubmission", () => {
  let contract: DataSubmissionMock;
  let mockSensorRegistry: Trait;
  let mockDataValidator: Trait;
  let mockTokenContract: Trait;
  let mockAlertSystem: Trait;
  let mockAnalyticsEngine: Trait;

  beforeEach(() => {
    contract = new DataSubmissionMock();
    mockSensorRegistry = { "is-registered": () => ({ ok: true, value: true }) };
    mockDataValidator = { "validate-data": () => ({ ok: true, value: true }) };
    mockTokenContract = { "mint": () => ({ ok: true, value: true }) };
    mockAlertSystem = { "trigger-alert": () => ({ ok: true, value: true }) };
    mockAnalyticsEngine = { "update-analytics": () => ({ ok: true, value: true }) };
  });

  it("rejects submission without oracle", () => {
    const result = contract.submitSoilData(1, 1, "a".repeat(64), { moisture: 50, ph: 7, nutrients: 200, temperature: 25 }, mockSensorRegistry, mockDataValidator, mockTokenContract, mockAlertSystem, mockAnalyticsEngine);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_ORACLE_NOT_SET);
  });

  it("rejects invalid metrics", () => {
    contract.setOraclePrincipal("ST2ORACLE");
    const result = contract.submitSoilData(1, 1, "a".repeat(64), { moisture: 101, ph: 7, nutrients: 200, temperature: 25 }, mockSensorRegistry, mockDataValidator, mockTokenContract, mockAlertSystem, mockAnalyticsEngine);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_MOISTURE);
  });

  it("sets oracle principal successfully", () => {
    const result = contract.setOraclePrincipal("ST2ORACLE");
    expect(result.ok).toBe(true);
    expect(contract.getOraclePrincipal().value).toBe("ST2ORACLE");
  });

  it("rejects set oracle by unauthorized", () => {
    contract.caller = "ST3FAKE";
    const result = contract.setOraclePrincipal("ST2ORACLE");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_UNAUTHORIZED);
  });

  it("sets reward per submission successfully", () => {
    const result = contract.setRewardPerSubmission(20);
    expect(result.ok).toBe(true);
    expect(contract.getRewardPerSubmission().value).toBe(20);
  });

  it("rejects invalid reward amount", () => {
    const result = contract.setRewardPerSubmission(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_REWARD_AMOUNT);
  });

  it("rejects invalid timestamp", () => {
    contract.setOraclePrincipal("ST2ORACLE");
    contract.submitSoilData(1, 1, "a".repeat(64), { moisture: 50, ph: 7, nutrients: 200, temperature: 25 }, mockSensorRegistry, mockDataValidator, mockTokenContract, mockAlertSystem, mockAnalyticsEngine);
    contract.blockHeight = 0;
    const result = contract.submitSoilData(1, 2, "b".repeat(64), { moisture: 60, ph: 8, nutrients: 300, temperature: 30 }, mockSensorRegistry, mockDataValidator, mockTokenContract, mockAlertSystem, mockAnalyticsEngine);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_TIMESTAMP_INVALID);
  });
});