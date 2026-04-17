# AI Prompts for Venture Platform

This directory contains AI prompt templates and guidelines for implementing consistent AI-powered features across the platform.

---

## 📁 Contents

### Active production prompts (code-backed)
- **[screening-scale-scorecard.md](./screening-scale-scorecard.md)** — SCALE scorecard at screening stage (`buildInsightsPrompt`)
- **[panel-scale-scorecard.md](./panel-scale-scorecard.md)** — Panel recommendation scorecard (`buildPanelInsightsPrompt`)
- **[venture-journey-roadmap.md](./venture-journey-roadmap.md)** — 12-16 week program roadmap (`buildRoadmapPrompt`)

### Reference prompts / design notes
- **[venture-analysis.md](./venture-analysis.md)** - Deep Dive analysis prompts for VSM screening
- **[agreement-generation.md](./agreement-generation.md)** - Contract and agreement generation prompts
- **[interview-questions.md](./interview-questions.md)** - AI-generated interview question prompts
- **[red-flags.md](./red-flags.md)** - Risk assessment and red flag detection prompts
- **[i-icon-application-process.md](./i-icon-application-process.md)** - Application process i-icon copy

---

## 🎯 Purpose

These prompts ensure:
- **Consistency** - All AI features use standardized formats
- **Quality** - Proven prompts that generate reliable outputs
- **Maintainability** - Easy to update and improve over time
- **Transparency** - Clear documentation of AI behavior

---

## 🔧 How to Use

### 1. Choose the Right Prompt
Select the prompt template that matches your feature requirement.

### 2. Customize with Context
Replace placeholders (e.g., `{venture_name}`, `{revenue}`) with actual data.

### 3. Call AI API
Use your preferred AI service (OpenAI, Anthropic, etc.) with the customized prompt.

### 4. Process Response
Parse and validate the AI response according to the expected format.

---

## 📝 Prompt Template Structure

Each prompt file follows this structure:

```markdown
# Feature Name

## Purpose
What this AI feature does

## Input Data Required
- field1: description
- field2: description

## Prompt Template
The actual prompt with placeholders

## Expected Output Format
JSON/Markdown structure of response

## Example
Sample input and output
```

---

## 🚀 Implementation Example

```typescript
// Example: Using the Deep Dive Analysis prompt
import { openai } from '@/lib/openai';

async function analyzeVenture(venture: Venture) {
  const prompt = `
    Analyze the following venture application and provide insights:
    
    Venture Name: ${venture.name}
    Founder: ${venture.founder_name}
    Revenue: ${venture.revenue_12m}
    Team Size: ${venture.full_time_employees}
    Growth Focus: ${venture.growth_focus}
    
    [Rest of prompt from venture-analysis.md]
  `;
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  });
  
  return response.choices[0].message.content;
}
```

---

## 🔐 Best Practices

### Security
- Never include sensitive data in prompts unless necessary
- Sanitize user inputs before including in prompts
- Use environment variables for API keys

### Performance
- Cache AI responses when appropriate
- Use streaming for long responses
- Implement retry logic for API failures

### Quality
- Test prompts with diverse inputs
- Monitor AI outputs for quality
- Collect user feedback on AI features

---

## 🎨 Customization Guidelines

When modifying prompts:

1. **Test thoroughly** - Verify outputs with multiple scenarios
2. **Document changes** - Update the prompt file with version notes
3. **Maintain format** - Keep consistent output structures
4. **Consider edge cases** - Handle missing or unusual data

---

## 📊 Prompt Versioning

Track prompt versions to maintain consistency:

```markdown
## Version History
- v1.0 (2026-02-17): Initial prompt
- v1.1 (2026-02-20): Added revenue analysis
- v1.2 (2026-02-25): Improved red flag detection
```

---

## 🤝 Contributing

When adding new AI features:

1. Create a new prompt file in this directory
2. Follow the standard template structure
3. Include examples and expected outputs
4. Test with real data before deploying
5. Update this README with the new file

---

## 📞 Support

For questions about AI prompts:
- Review existing prompt files for examples
- Check the main [ARCHITECTURE.md](./ARCHITECTURE.md) for system context
- Test prompts in AI playground before implementation

---

**Last Updated:** 2026-04-17
