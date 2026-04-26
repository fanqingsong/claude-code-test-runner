# AI-Powered Test Case Generation Feature

## Overview

Generate complete test cases with steps using Claude AI, achieving full test automation workflow.

## Current System Analysis

### Test Definition Structure
- **TestDefinition**: Test case metadata (name, description, url, tags, environment)
- **TestStep**: Individual steps with description, type, params, expected_result
- **Current Flow**: Manual test case creation → Scheduling → Execution

### Gap
Users must manually create test cases. No AI generation capability exists.

## Proposed Solution

### Feature: AI Test Case Generator

**User Input:**
- Application URL/Description
- Test requirements (natural language)
- Test type (functional, UI, API, performance, etc.)
- Optional: User credentials, test data

**AI Output:**
- Complete test case with multiple steps
- Each step with natural language description
- Playwright-compatible action types
- Expected results
- Tags for categorization

**Process:**
1. User provides requirements via API
2. Claude AI analyzes requirements
3. Generates comprehensive test case
4. Saves to database (TestDefinition + TestSteps)
5. Ready for scheduling and execution

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Test Generation API                             │
│  POST /api/v1/test-generation/generate          │
└────────────┬────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────┐
│  TestCaseGenerator Service                      │
│  - Build prompt for Claude                      │
│  - Parse AI response                            │
│  - Create TestDefinition                        │
│  - Create TestSteps                             │
└────────────┬────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────┐
│  Anthropic Claude API                           │
│  - Analyze requirements                         │
│  - Generate test steps                          │
│  - Suggest test data                            │
└────────────┬────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────┐
│  Database (PostgreSQL)                          │
│  - TestDefinition table                         │
│  - TestStep table                               │
└─────────────────────────────────────────────────┘
```

## API Design

### Generate Test Case

```http
POST /api/v1/test-generation/generate
Content-Type: application/json

{
  "app_url": "https://example.com/login",
  "app_description": "E-commerce login page",
  "requirements": "Test user login with valid credentials, verify error messages for invalid credentials, test forgot password link",
  "test_type": "functional",
  "credentials": {
    "username": "test@example.com",
    "password": "Test@123"
  },
  "tags": ["authentication", "critical", "smoke"]
}
```

### Response

```json
{
  "test_definition": {
    "id": 123,
    "name": "User Login Authentication Tests",
    "description": "Comprehensive test for login functionality",
    "test_id": "TC-LOGIN-001",
    "url": "https://example.com/login",
    "tags": ["authentication", "critical", "smoke"],
    "environment": {},
    "is_active": true,
    "created_by": "ai-generator"
  },
  "test_steps": [
    {
      "id": 1,
      "step_number": 1,
      "description": "Navigate to the login page",
      "type": "navigation",
      "params": {"url": "https://example.com/login"},
      "expected_result": "Login page is displayed"
    },
    {
      "id": 2,
      "step_number": 2,
      "description": "Enter valid username 'test@example.com' in the username field",
      "type": "input",
      "params": {"selector": "input[name='username']", "value": "test@example.com"},
      "expected_result": "Username is entered in the field"
    },
    {
      "id": 3,
      "step_number": 3,
      "description": "Enter valid password 'Test@123' in the password field",
      "type": "input",
      "params": {"selector": "input[name='password']", "value": "Test@123"},
      "expected_result": "Password is entered and masked"
    },
    {
      "id": 4,
      "step_number": 4,
      "description": "Click the login button",
      "type": "click",
      "params": {"selector": "button[type='submit']"},
      "expected_result": "User is redirected to dashboard"
    },
    {
      "id": 5,
      "step_number": 5,
      "description": "Verify that welcome message is displayed",
      "type": "verification",
      "params": {"selector": ".welcome-message", "text": "Welcome"},
      "expected_result": "Welcome message is visible"
    }
  ],
  "metadata": {
    "total_steps": 5,
    "estimated_duration": "2-3 minutes",
    "complexity": "medium",
    "ai_model": "claude-sonnet-4-20250514"
  }
}
```

## Implementation Components

### 1. New Service: `TestCaseGenerator`

**Location**: `scheduler-service/app/services/test_case_generator.py`

**Responsibilities**:
- Build comprehensive prompts for Claude
- Parse AI responses into structured data
- Generate unique test IDs
- Validate generated test cases
- Handle AI errors and retries

### 2. New API Endpoint

**Location**: `scheduler-service/app/api/v1/endpoints/test_generation.py`

**Endpoints**:
- `POST /generate` - Generate test case from requirements
- `POST /generate-batch` - Generate multiple test cases
- `GET /templates` - Get prompt templates
- `POST /validate` - Validate test case before saving

### 3. Pydantic Schemas

**Location**: `scheduler-service/app/schemas/test_generation.py`

**Schemas**:
- `TestCaseGenerateRequest` - Input requirements
- `TestCaseGenerateResponse` - Generated test case
- `TestStepGenerated` - Generated step structure
- `GenerationMetadata` - AI metadata

### 4. Prompt Templates

**Templates for different test types**:
- Functional tests
- UI/UX tests
- API tests
- Performance tests
- Security tests
- E2E scenarios

### 5. Database Integration

**Save to existing tables**:
- `test_definitions` - Test case metadata
- `test_steps` - Individual steps

## Prompt Engineering

### Base Prompt Structure

```
You are an expert QA test case generator. Generate comprehensive test cases based on the following requirements:

Application URL: {app_url}
Application Description: {app_description}
Test Requirements: {requirements}
Test Type: {test_type}
Test Credentials: {credentials}

Generate a test case with:
1. Clear test name and description
2. 5-10 detailed test steps
3. Each step should include:
   - Natural language description (for AI interpretation)
   - Action type (navigate, click, input, verify, wait, etc.)
   - Selectors (CSS selectors when applicable)
   - Test data
   - Expected result

Return the response in the following JSON format:
{
  "name": "Test Case Name",
  "description": "Test case description",
  "steps": [
    {
      "step_number": 1,
      "description": "Natural language description",
      "type": "action_type",
      "params": {...},
      "expected_result": "Expected outcome"
    }
  ]
}
```

## Enhanced Features

### 1. Multi-Test Generation

Generate related test cases in one call:
- Happy path
- Negative scenarios
- Edge cases
- Boundary testing

### 2. Test Data Generation

Auto-generate realistic test data:
- User credentials
- Product data
- Form inputs
- Edge case values

### 3. Smart Selector Suggestions

Claude suggests CSS selectors:
- By ID, class, name
- By text content
- By aria-label
- Playwright strategies

### 4. Test Case Templates

Pre-built templates for common scenarios:
- User authentication
- CRUD operations
- Search and filter
- Form validation
- Payment flows

## Integration with Existing Features

### Full Automation Workflow

```
1. User provides requirements (API/UI)
   ↓
2. Claude AI generates test case
   ↓
3. Test case saved to database
   ↓
4. User reviews and edits (optional)
   ↓
5. Schedule test execution
   ↓
6. Celery Beat triggers execution
   ↓
7. Playwright executes steps
   ↓
8. Results saved and reported
```

### Seamless Integration

- ✅ Uses existing TestDefinition model
- ✅ Uses existing TestStep model
- ✅ Works with scheduler service
- ✅ Compatible with test execution engine
- ✅ Supports manual editing after generation

## Example Usage Scenarios

### Scenario 1: E-commerce Checkout

**Input:**
```json
{
  "app_url": "https://shop.example.com/checkout",
  "app_description": "E-commerce checkout page with cart summary and payment form",
  "requirements": "Test complete checkout flow: review items, enter shipping info, select payment method, place order",
  "test_type": "e2e",
  "credentials": {
    "email": "customer@test.com"
  }
}
```

**Output**: Test case with 12 steps covering entire checkout flow

### Scenario 2: API Testing

**Input:**
```json
{
  "app_url": "https://api.example.com/users",
  "app_description": "REST API for user management",
  "requirements": "Test CRUD operations for users endpoint",
  "test_type": "api"
}
```

**Output**: Multiple test cases for GET, POST, PUT, DELETE operations

## Benefits

### 1. Complete Automation
- From requirements to execution
- No manual test case writing
- Faster time to value

### 2. Quality Improvement
- AI generates comprehensive steps
- Covers edge cases
- Consistent test structure

### 3. Efficiency
- Generate 100+ test cases in minutes
- Reduce manual effort by 90%
- Focus on review, not creation

### 4. Scalability
- Easy to add new test cases
- Batch generation support
- Template-based consistency

## Implementation Plan

### Phase 1: Core Generation (Week 1)
- Basic prompt engineering
- Single test case generation
- Database integration
- Error handling

### Phase 2: Enhanced Features (Week 2)
- Batch generation
- Multiple test types
- Test data generation
- Selector suggestions

### Phase 3: Advanced Features (Week 3)
- Template library
- Smart suggestions
- Test case optimization
- Historical learning

### Phase 4: Integration & Polish (Week 4)
- UI integration
- Performance optimization
- Documentation
- User testing

## Success Metrics

- **Generation Time**: < 10 seconds per test case
- **Quality**: 90%+ usable without modification
- **Coverage**: 50%+ reduction in manual effort
- **Adoption**: 100+ test cases generated in first week

## Next Steps

1. Review and approve design
2. Create implementation plan
3. Set up development environment
4. Implement core generation service
5. Build API endpoints
6. Test with real requirements
7. Deploy and monitor
