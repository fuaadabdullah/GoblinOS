# Huntress Guild Goblin

**Huntress Guild** - Flaky test hunts, regression triage, incident tagging; early-signal scouting, log mining, trend surfacing.

## Overview

The Huntress Guild goblin provides comprehensive test analysis and incident management capabilities for the GoblinOS ecosystem. It specializes in:

- **Flaky Test Detection**: Identifies tests that fail intermittently using statistical analysis
- **Regression Triage**: Analyzes recent commits to identify root causes of regressions
- **Incident Management**: Automated incident reporting and tagging
- **Signal Scouting**: Early detection of potential issues through log analysis and trend monitoring

## Features

### Test Analysis
- Statistical flaky test detection with configurable thresholds
- Pattern recognition for test failure analysis
- Comprehensive test suite result processing

### Regression Triage
- Git blame analysis for recent commits
- Impact assessment for failed tests
- Automated incident tagging

### Signal Scouting
- Log file monitoring and analysis
- Early signal detection with configurable thresholds
- Trend analysis over configurable time windows

### Incident Reporting
- Structured incident reporting with severity levels
- Automated resolution workflows
- Multi-channel notification support

## Configuration

The goblin uses JSON Schema validated configuration in `config/default.json`:

```json
{
  "test_analysis": {
    "min_runs_for_flaky_detection": 5,
    "flaky_threshold": 0.1,
    "enable_pattern_recognition": true,
    "log_analysis_depth": 1000
  },
  "regression_triage": {
    "git_blame_depth": 10,
    "impact_assessment_enabled": true,
    "auto_tag_incidents": true
  },
  "signal_scouting": {
    "log_files_patterns": ["*.log", "logs/*.log"],
    "early_signal_threshold": 0.05,
    "trend_analysis_window": 7
  },
  "incident_reporting": {
    "severity_threshold": "medium",
    "auto_resolution_enabled": false,
    "notification_channels": []
  }
}
```

## Usage

### Via GoblinLoader

```python
from goblinos.loader import GoblinLoader

loader = GoblinLoader()
goblin = loader.load_goblin("huntress-guild")

# Analyze tests
await goblin.execute(["analyze_tests", "--project", "apps/forge-lite"])

# Triage regression
await goblin.execute(["triage_regression", "--commit", "abc123"])
```

### Direct Commands

```bash
# Analyze tests in a project
python test.py analyze_tests --project apps/forge-lite

# Triage a regression
python test.py triage_regression --commit abc123

# Scout for early signals
python test.py scout_signals --days 7
```

## Dependencies

- `goblinos-shared>=0.1.0` - Core GoblinOS interfaces
- `pydantic>=2.0.0` - Data validation and serialization
- `jsonschema>=4.0.0` - JSON Schema validation
- `pathlib2>=2.3.0` - Enhanced path operations
- `asyncio-mqtt>=0.13.0` - Async MQTT client
- `aiofiles>=0.23.0` - Async file operations

## Development

### Setup

```bash
# Install dependencies
pip install -e .

# Install dev dependencies
pip install -e ".[dev]"
```

### Testing

```bash
# Run tests
python test.py

# Run with specific configuration
python test.py --config config/custom.json
```

### Code Quality

```bash
# Format code
black src/

# Sort imports
isort src/

# Type checking
mypy src/
```

## Architecture

The goblin follows the Python Goblin Package Blueprint:

```
huntress-guild/
├── src/
│   ├── __init__.py      # Package initialization
│   ├── goblin.py        # GoblinInterface implementation
│   ├── logic.py         # Core business logic
│   ├── schema.py        # Pydantic models and schemas
│   └── types.py         # Type definitions
├── config/
│   ├── default.json     # Default configuration
│   └── schema.json      # JSON Schema validation
├── pyproject.toml       # Package configuration
├── test.py             # Test script
└── README.md           # This file
```

## KPIs

- `flaky_rate`: Percentage of tests identified as flaky
- `mttr_test_failures`: Mean time to resolution for test failures
- `valid_early_signals`: Number of valid early signals detected
- `false_positive_rate`: Rate of false positive signal detections

## Integration

This goblin integrates with:

- **GoblinOS Core**: Via GoblinInterface for lifecycle management
- **Git**: For regression analysis and blame tracking
- **Test Frameworks**: For test result parsing and analysis
- **Logging Systems**: For signal scouting and trend analysis
- **Notification Systems**: For incident reporting

## Contributing

1. Follow the Python Goblin Package Blueprint
2. Add tests for new functionality
3. Update configuration schema for new features
4. Maintain async-first design patterns
5. Use Pydantic for all data models
