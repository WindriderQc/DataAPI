# Test Strategy Assessment Report

## Executive Summary
The project has a solid foundation for testing with a clear separation between unit and integration tests. However, the current strategy faces several challenges:
1.  **CI/CD Gap**: Tests are not executed in the CI pipeline (`.github/workflows/deploy.yml`), allowing broken code to be deployed.
2.  **Test Failures**: Significant failures exist in `liveData` related tests (both unit and integration), indicating either regressions or outdated tests.
3.  **Skipped Tests**: Critical authentication tests (`auth.test.js`) were skipped, though they appear to pass when enabled.
4.  **Coverage Visibility**: There is no code coverage reporting to guide future testing efforts.

## Current State Analysis

### 1. Infrastructure & Configuration
-   **Framework**: Jest + Supertest.
-   **Environment**: `NODE_ENV=test` uses `mongodb-memory-server` for isolation, which is a best practice.
-   **Setup**: `tests/test-setup.js` handles global app and DB initialization.
-   **Dependencies**: `jest`, `supertest`, `mongodb-memory-server`, `fs-extra` are correctly installed.

### 2. Test Coverage
-   **Unit Tests (5 files)**: Covers `fetch-utils`, `fileBrowserController`, `liveDataConfig`, `rbac`, `weatherController`.
    -   *Status*: `liveDataConfig.test.js` is failing consistently due to mocking/spy mismatches.
-   **Integration Tests (16 files)**: Covers major subsystems (`auth`, `db`, `user`, `alarm`, `liveData`, `storage`, etc.).
    -   *Status*: `liveData` integration tests are failing (timeouts/assertions).
    -   *Status*: `auth.test.js` was skipped but is functional.
    -   *Status*: `storage_export.test.js` skips gracefully when auth requirements aren't met.

### 3. Critical Issues
-   **`liveData` Failures**:
    -   Unit tests fail to assert `setInterval` calls, likely due to how `liveData.js` is handling config reloading or module state.
    -   Integration tests fail to verify data persistence and MQTT publishing for ISS/Quakes.
-   **CI Pipeline**: The `deploy.yml` workflow performs a "fire and forget" deployment without verifying build or test status.

## Recommendations

### Short Term (Immediate Action)
1.  **Fix `liveData` Tests**: Investigate and fix the mocking in `liveDataConfig.test.js` and the race conditions/logic in `liveData.integration.test.js`.
2.  **Enable Auth Tests**: Permanently un-skip `auth.test.js`.
3.  **Integrate CI**: Add a `run-tests` job to the GitHub Actions workflow to block deployment on test failure.

### Medium Term
1.  **Add Coverage Reporting**: Configure Jest to generate text/html coverage reports to identify untested areas.
2.  **Refine Test Isolation**: Ensure `jest.resetModules()` and global setup/teardown are robust to prevent test leakage (currently using `--forceExit`).
3.  **Pre-commit Hooks**: Implement `husky` or similar to run linters and critical tests before commit.

## Proposed Plan

1.  **Fix Broken Tests**:
    -   Debug and fix `tests/unit/liveDataConfig.test.js`.
    -   Debug and fix `tests/integration/liveData.integration.test.js` and `liveData.activation.integration.test.js`.
    -   Commit the un-skip of `tests/integration/auth.test.js`.
2.  **Update CI Configuration**:
    -   Modify `.github/workflows/deploy.yml` to include an `npm test` step before deployment.
3.  **Add Coverage**:
    -   Update `package.json` to include coverage scripts.
