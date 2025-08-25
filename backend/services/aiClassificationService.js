const { OpenAI } = require('openai');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

class AIClassificationService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    this.model = 'gpt-3.5-turbo';
    this.maxTokens = 4000;
    this.temperature = 0.1; // Low temperature for consistent results
  }
  
  // Main classification method
  async classifyCase(extractedText, caseTitle = '', jurisdiction = '') {
    const startTime = Date.now();
    
    try {
      if (!extractedText || extractedText.trim().length === 0) {
        throw new AppError('No text provided for classification', 400, 'NO_TEXT');
      }
      
      // Prepare the prompt
      const prompt = this.buildClassificationPrompt(extractedText, caseTitle, jurisdiction);
      
      // Call OpenAI API
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        response_format: { type: 'json_object' }
      });
      
      const processingTime = Date.now() - startTime;
      
      // Parse and validate response
      const result = this.parseAIResponse(response.choices[0].message.content);
      
      // Add metadata
      result.metadata = {
        model: this.model,
        processingTime,
        tokensUsed: response.usage.total_tokens,
        extractedAt: new Date()
      };
      
      logger.info(`AI classification completed in ${processingTime}ms`, {
        urgency: result.urgency,
        confidence: result.confidence,
        tokensUsed: response.usage.total_tokens
      });
      
      return result;
      
    } catch (error) {
      logger.error('AI classification failed:', error);
      
      if (error.isOperational) {
        throw error;
      }
      
      // Handle OpenAI specific errors
      if (error.code === 'insufficient_quota') {
        throw new AppError('AI service quota exceeded', 503, 'AI_QUOTA_EXCEEDED');
      }
      
      if (error.code === 'rate_limit_exceeded') {
        throw new AppError('AI service rate limit exceeded', 429, 'AI_RATE_LIMITED');
      }
      
      if (error.code === 'invalid_api_key') {
        throw new AppError('AI service configuration error', 500, 'AI_CONFIG_ERROR');
      }
      
      throw new AppError('AI classification service unavailable', 503, 'AI_SERVICE_ERROR');
    }
  }
  
  // Build the classification prompt
  buildClassificationPrompt(text, title, jurisdiction) {
    // Truncate text if too long (keep first and last parts)
    const maxTextLength = 8000;
    let processedText = text;
    
    if (text.length > maxTextLength) {
      const keepLength = Math.floor(maxTextLength / 2);
      processedText = text.substring(0, keepLength) + 
                    '\n\n[... MIDDLE SECTION TRUNCATED ...]\n\n' +
                    text.substring(text.length - keepLength);
    }
    
    return `Please analyze the following legal document and extract structured information:

CASE TITLE: ${title}
JURISDICTION: ${jurisdiction || 'Not specified'}

DOCUMENT TEXT:
${processedText}

Please provide a JSON response with the following structure and be very precise with urgency classification according to Indian legal system:`;
  }
  
  // System prompt for AI
  getSystemPrompt() {
    return `You are an expert Indian legal intake triage assistant with deep knowledge of Indian legal system, IPC, CrPC, CPC, and various Indian laws. Your task is to analyze legal documents and extract structured information for case classification and assignment.

URGENCY CLASSIFICATION GUIDELINES:
- URGENT: Cases requiring immediate attention (within 24-48 hours)
  * Rape/POCSO cases (IPC 376, POCSO Act)
  * Terrorism cases (UAPA, NIA cases)
  * Ongoing violence/threats to life
  * Kidnapping/abduction cases
  * Cases involving minors in danger
  * Anticipatory bail in serious offenses
  * Time-barred statutory deadlines (within 7 days)
  * Public safety emergencies
  * Custodial violence/death
  
- MODERATE: Important cases needing prompt attention (within 1-2 weeks)
  * Significant financial fraud (>10 lakhs)
  * Property disputes with possession issues
  * Domestic violence cases
  * Cheque bounce cases (NI Act)
  * Employment disputes with immediate impact
  * Consumer complaints with ongoing harm
  * Bail applications in non-heinous crimes
  
- LOW: Standard cases with normal processing time
  * Civil suits for money recovery
  * Property title disputes
  * Minor criminal cases (simple hurt, theft)
  * Contractual disputes
  * Administrative matters
  * Routine civil applications

RISK SIGNALS TO IDENTIFY:
- Threats to life or safety
- Ongoing criminal activity
- Involvement of minors
- Public order concerns
- Time-sensitive legal deadlines
- Evidence tampering risks
- Witness intimidation

JURISDICTION SIGNALS:
- Court names mentioned
- Police station names
- District/state names
- Case numbers with court codes

You must respond ONLY in valid JSON format with no additional text or explanations. Be conservative with urgency - when in doubt, classify as MODERATE rather than URGENT.`;
  }
  
  // Parse and validate AI response
  parseAIResponse(responseContent) {
    try {
      const parsed = JSON.parse(responseContent);
      
      // Validate required fields
      const required = ['parties', 'subjectMatter', 'urgency', 'confidence'];
      for (const field of required) {
        if (!(field in parsed)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
      
      // Validate urgency value
      if (!['URGENT', 'MODERATE', 'LOW'].includes(parsed.urgency)) {
        logger.warn(`Invalid urgency value: ${parsed.urgency}, defaulting to MODERATE`);
        parsed.urgency = 'MODERATE';
      }
      
      // Validate confidence value
      if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) {
        logger.warn(`Invalid confidence value: ${parsed.confidence}, defaulting to 0.5`);
        parsed.confidence = 0.5;
      }
      
      // Ensure arrays are arrays
      if (!Array.isArray(parsed.parties)) {
        parsed.parties = [];
      }
      
      if (!Array.isArray(parsed.riskSignals)) {
        parsed.riskSignals = [];
      }
      
      if (!Array.isArray(parsed.jurisdictionSignals)) {
        parsed.jurisdictionSignals = [];
      }
      
      // Structure the response
      return {
        parties: parsed.parties.map(party => ({
          name: party.name || '',
          type: party.type || 'unknown',
          email: party.email || null,
          representation: party.representation || null
        })),
        subjectMatter: parsed.subjectMatter || 'Not specified',
        riskSignals: parsed.riskSignals || [],
        jurisdictionSignals: parsed.jurisdictionSignals || [],
        urgency: parsed.urgency,
        confidence: parsed.confidence,
        reasoningBrief: parsed.reasoningBrief || 'No reasoning provided',
        legalCategories: parsed.legalCategories || [],
        estimatedComplexity: parsed.estimatedComplexity || 'medium',
        suggestedExpertise: parsed.suggestedExpertise || []
      };
      
    } catch (error) {
      logger.error('Failed to parse AI response:', error);
      logger.error('Raw response:', responseContent);
      
      // Return fallback response
      return {
        parties: [],
        subjectMatter: 'Classification failed',
        riskSignals: [],
        jurisdictionSignals: [],
        urgency: 'MODERATE',
        confidence: 0.1,
        reasoningBrief: 'AI classification failed, manual review required',
        legalCategories: [],
        estimatedComplexity: 'unknown',
        suggestedExpertise: []
      };
    }
  }
  
  // Analyze case complexity
  async analyzeComplexity(extractedText, aiIntake) {
    try {
      const complexityPrompt = `Based on the following legal document analysis, determine the case complexity:

SUBJECT MATTER: ${aiIntake.subjectMatter}
PARTIES: ${aiIntake.parties.map(p => p.name).join(', ')}
RISK SIGNALS: ${aiIntake.riskSignals.join(', ')}

DOCUMENT EXCERPT: ${extractedText.substring(0, 2000)}

Rate complexity as: low, medium, high, or very_high
Consider factors like:
- Number of parties involved
- Legal complexity
- Evidence requirements
- Potential trial duration
- Appeals likelihood

Respond with JSON: {"complexity": "level", "reasoning": "brief explanation"}`;
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: complexityPrompt }
        ],
        max_tokens: 500,
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });
      
      const result = JSON.parse(response.choices[0].message.content);
      return {
        complexity: result.complexity || 'medium',
        reasoning: result.reasoning || 'No reasoning provided'
      };
      
    } catch (error) {
      logger.error('Complexity analysis failed:', error);
      return {
        complexity: 'medium',
        reasoning: 'Complexity analysis failed'
      };
    }
  }
  
  // Extract key dates from document
  extractKeyDates(text) {
    const datePatterns = [
      /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/g,
      /(\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/gi,
      /(?:dated?|on|from)\s+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi
    ];
    
    const dates = [];
    
    for (const pattern of datePatterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        dates.push({
          date: match[1],
          context: text.substring(Math.max(0, match.index - 50), match.index + 50)
        });
      }
    }
    
    return dates;
  }
  
  // Extract monetary amounts
  extractMonetaryAmounts(text) {
    const amountPatterns = [
      /(?:Rs\.?|INR|₹)\s*(\d+(?:,\d+)*(?:\.\d{2})?)/gi,
      /(\d+(?:,\d+)*(?:\.\d{2})?)\s*(?:rupees?|lakhs?|crores?)/gi
    ];
    
    const amounts = [];
    
    for (const pattern of amountPatterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        amounts.push({
          amount: match[1],
          context: text.substring(Math.max(0, match.index - 30), match.index + 30)
        });
      }
    }
    
    return amounts;
  }
  
  // Validate classification result
  validateClassification(result) {
    const issues = [];
    
    if (!result.urgency || !['URGENT', 'MODERATE', 'LOW'].includes(result.urgency)) {
      issues.push('Invalid urgency classification');
    }
    
    if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) {
      issues.push('Invalid confidence score');
    }
    
    if (!result.subjectMatter || result.subjectMatter.trim().length === 0) {
      issues.push('Missing subject matter');
    }
    
    if (result.confidence < 0.3) {
      issues.push('Very low confidence classification');
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      needsManualReview: issues.length > 0 || result.confidence < 0.5
    };
  }
  
  // Get classification statistics
  async getClassificationStats(startDate, endDate) {
    // This would typically query a database
    // For now, return placeholder stats
    return {
      totalClassifications: 0,
      urgencyDistribution: {
        URGENT: 0,
        MODERATE: 0,
        LOW: 0
      },
      averageConfidence: 0,
      averageProcessingTime: 0,
      failureRate: 0
    };
  }
}

module.exports = new AIClassificationService();
