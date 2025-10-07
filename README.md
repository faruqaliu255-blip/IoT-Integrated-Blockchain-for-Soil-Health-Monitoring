# 🌱 IoT-Integrated Blockchain for Soil Health Monitoring

Welcome to a revolutionary platform that empowers farmers and agronomists to monitor soil health in real-time using IoT devices, with data securely stored and verified on the Stacks blockchain. This project addresses critical real-world issues in agriculture, such as soil degradation, inefficient resource use, and lack of transparent data for sustainable farming. By integrating IoT sensors with blockchain, it ensures tamper-proof records, incentivizes data sharing, and enables predictive analytics for better crop yields and environmental conservation.

## ✨ Features

🌍 Real-time soil data collection via IoT sensors (moisture, pH, nutrients, temperature)  
🔒 Immutable and verifiable data storage on blockchain  
💰 Token-based incentives for farmers sharing quality data  
📊 Analytics and predictions for soil health trends  
🤝 Data marketplace for researchers and agribusinesses  
🚨 Alerts for soil degradation or optimization opportunities  
✅ Compliance with agricultural standards through smart contract audits  
🌐 Decentralized governance for platform updates  

## 🛠 How It Works

This project leverages Clarity smart contracts on the Stacks blockchain to create a decentralized ecosystem. IoT devices collect soil metrics and submit them via oracles or direct integrations, ensuring data integrity without central authorities.

### For Farmers
- Deploy IoT sensors in fields to gather data automatically.
- Register your farm and sensors using the FarmerProfile and SensorRegistry contracts.
- Submit data batches via the DataSubmission contract, which validates and timestamps them.
- Earn rewards in platform tokens (via TokenContract) for consistent, high-quality contributions.
- Use the AlertSystem contract to receive notifications on soil issues.

### For Researchers/Agronomists
- Access aggregated, anonymized data through the DataAccessControl contract.
- Purchase specific datasets from the DataMarketplace contract.
- Run on-chain queries with the AnalyticsEngine contract for insights like nutrient trends.
- Verify data provenance using the DataValidation contract.

### For Platform Governance
- Stake tokens in the GovernanceDAO contract to vote on upgrades, such as adding new sensor types or adjusting reward rates.

## 📜 Smart Contracts Overview
The project involves 8 Clarity smart contracts for modularity, security, and scalability:

1. **FarmerProfile.clar**: Manages farmer registrations, profiles, and ownership of IoT devices. Includes functions to add/update farm details and link sensors.
2. **SensorRegistry.clar**: Registers and authenticates IoT devices. Ensures only verified sensors can submit data, preventing spoofing.
3. **DataSubmission.clar**: Handles incoming soil data from IoT devices. Timestamps and stores hashes of data batches for immutability.
4. **DataValidation.clar**: Validates submitted data against predefined rules (e.g., range checks for pH levels) and integrates with oracles for off-chain verification.
5. **TokenContract.clar**: Implements a fungible token (e.g., SOIL tokens) for rewards, staking, and payments within the ecosystem.
6. **DataAccessControl.clar**: Manages permissions for data access, using role-based controls to ensure privacy (e.g., farmers control their data sharing).
7. **AnalyticsEngine.clar**: Provides basic on-chain analytics, like averaging soil metrics over time or flagging anomalies.
8. **DataMarketplace.clar**: Enables buying/selling of soil data datasets, with automated escrow and revenue sharing.
9. **AlertSystem.clar**: Triggers notifications based on data thresholds, integrating with external messaging via Clarity's event emissions.
10. **GovernanceDAO.clar**: Allows token holders to propose and vote on changes, ensuring community-driven evolution.

These contracts interact seamlessly—for example, DataSubmission calls DataValidation before storing, and rewards are minted via TokenContract upon successful validation. Start by deploying them on the Stacks testnet, and integrate IoT data feeds using libraries like Hiro's Clarity tools.

Get started today and help build a sustainable future for agriculture! 🚀