# DMS Report Automation System

A web-based automation system designed to automate report extraction from a simulated Dealer Management System (DMS).

The system uses Playwright to automate report downloads, validates CSV files, detects duplicate records, processes and imports data into PostgreSQL, and provides a centralized dashboard to monitor report execution, processing status, logs and schedules.

## Key Features

- Automated DMS report extraction using Playwright
- OTP-based authentication for manual execution
- Automated authentication for scheduled execution
- CSV validation and duplicate detection
- Data processing and PostgreSQL integration
- Scheduled report execution using node-cron
- Centralized dashboard for monitoring and management
- Execution history, logs and report configuration

## Technology Stack

- **Frontend:** React, Vite
- **Backend:** Node.js, Express.js
- **Database:** PostgreSQL
- **Browser Automation:** Playwright
- **Scheduling:** node-cron

## Project Modules

- **Mock DMS:** Simulated Dealer Management System
- **Automation Backend:** Handles scheduling, execution and data processing
- **Playwright Automation:** Automates report extraction
- **Dashboard:** Provides report monitoring and management
- **Database:** Stores configurations, execution history and processed report data

## Team

Project-Commit-Crew  
Full Stack Development Internship Project  
ICT Academy of Kerala
