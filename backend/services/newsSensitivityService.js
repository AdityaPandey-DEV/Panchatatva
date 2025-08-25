const axios = require('axios');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

class NewsSensitivityService {
  constructor() {
    this.provider = process.env.NEWS_PROVIDER || 'BING';
    this.bingApiKey = process.env.BING_NEWS_API_KEY;
    this.newsApiKey = process.env.NEWSAPI_KEY;
    
    // Base URLs
    this.bingBaseUrl = 'https://api.bing.microsoft.com/v7.0/news/search';
    this.newsApiBaseUrl = 'https://newsapi.org/v2/everything';
    
    // Cache for recent searches (in production, use Redis)
    this.searchCache = new Map();
    this.cacheTimeout = 30 * 60 * 1000; // 30 minutes
  }
  
  // Main method to check news sensitivity
  async checkNewsSensitivity(aiIntake, jurisdiction = null) {
    const startTime = Date.now();
    
    try {
      // Extract keywords for news search
      const keywords = this.extractSearchKeywords(aiIntake, jurisdiction);
      
      if (keywords.length === 0) {
        logger.info('No keywords extracted for news search');
        return this.getDefaultNewsSignals();
      }
      
      // Search for relevant news
      const newsResults = await this.searchNews(keywords);
      
      // Analyze news for sensitivity
      const analysis = this.analyzeNewsSensitivity(newsResults, aiIntake, jurisdiction);
      
      const processingTime = Date.now() - startTime;
      
      logger.info(`News sensitivity check completed in ${processingTime}ms`, {
        keywords: keywords.length,
        articles: newsResults.length,
        score: analysis.score
      });
      
      return {
        ...analysis,
        processingTime,
        keywords,
        lastCheckedAt: new Date()
      };
      
    } catch (error) {
      logger.error('News sensitivity check failed:', error);
      
      // Return default signals on failure
      return {
        ...this.getDefaultNewsSignals(),
        error: error.message,
        processingTime: Date.now() - startTime,
        lastCheckedAt: new Date()
      };
    }
  }
  
  // Extract keywords for news search
  extractSearchKeywords(aiIntake, jurisdiction) {
    const keywords = new Set();
    
    // Add subject matter keywords
    if (aiIntake.subjectMatter) {
      const subjectKeywords = this.extractKeywordsFromText(aiIntake.subjectMatter);
      subjectKeywords.forEach(keyword => keywords.add(keyword));
    }
    
    // Add party names (but be careful with privacy)
    if (aiIntake.parties && aiIntake.parties.length > 0) {
      aiIntake.parties.forEach(party => {
        if (party.name && party.name.length > 3) {
          // Only add if it looks like a public figure or organization
          if (this.isLikelyPublicEntity(party.name)) {
            keywords.add(party.name);
          }
        }
      });
    }
    
    // Add jurisdiction-based keywords
    if (jurisdiction) {
      const jurisdictionKeywords = this.extractKeywordsFromText(jurisdiction);
      jurisdictionKeywords.forEach(keyword => keywords.add(keyword));
    }
    
    // Add jurisdiction signals
    if (aiIntake.jurisdictionSignals) {
      aiIntake.jurisdictionSignals.forEach(signal => {
        const signalKeywords = this.extractKeywordsFromText(signal);
        signalKeywords.forEach(keyword => keywords.add(keyword));
      });
    }
    
    // Add risk signal keywords
    if (aiIntake.riskSignals) {
      aiIntake.riskSignals.forEach(signal => {
        const riskKeywords = this.extractKeywordsFromText(signal);
        riskKeywords.forEach(keyword => keywords.add(keyword));
      });
    }
    
    // Filter and prioritize keywords
    return this.filterAndPrioritizeKeywords(Array.from(keywords));
  }
  
  // Extract keywords from text
  extractKeywordsFromText(text) {
    if (!text) return [];
    
    // Common legal and location terms that are newsworthy
    const importantTerms = [
      // Legal terms
      'IPC', 'CrPC', 'POCSO', 'UAPA', 'dowry', 'rape', 'murder', 'terrorism',
      'corruption', 'fraud', 'scam', 'encounter', 'custodial', 'police',
      
      // Locations (major cities and states)
      'Delhi', 'Mumbai', 'Kolkata', 'Chennai', 'Bangalore', 'Hyderabad',
      'Punjab', 'Haryana', 'Rajasthan', 'Gujarat', 'Maharashtra', 'Karnataka',
      'Tamil Nadu', 'Kerala', 'West Bengal', 'Uttar Pradesh', 'Bihar',
      
      // Organizations
      'CBI', 'ED', 'NIA', 'Supreme Court', 'High Court', 'Parliament',
      'Assembly', 'BJP', 'Congress', 'AAP'
    ];
    
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
    
    return words.filter(word => 
      importantTerms.some(term => 
        term.toLowerCase().includes(word) || word.includes(term.toLowerCase())
      )
    );
  }
  
  // Check if name is likely a public entity
  isLikelyPublicEntity(name) {
    const publicIndicators = [
      'government', 'ministry', 'department', 'corporation', 'limited',
      'ltd', 'inc', 'pvt', 'private', 'public', 'bank', 'insurance',
      'university', 'college', 'hospital', 'police', 'court', 'tribunal'
    ];
    
    const lowerName = name.toLowerCase();
    return publicIndicators.some(indicator => lowerName.includes(indicator));
  }
  
  // Filter and prioritize keywords
  filterAndPrioritizeKeywords(keywords) {
    // Remove very common words
    const stopWords = ['case', 'court', 'legal', 'matter', 'section', 'act'];
    
    const filtered = keywords
      .filter(keyword => keyword.length > 2)
      .filter(keyword => !stopWords.includes(keyword.toLowerCase()))
      .slice(0, 10); // Limit to top 10 keywords
    
    return filtered;
  }
  
  // Search for news using configured provider
  async searchNews(keywords) {
    const cacheKey = keywords.sort().join('|');
    
    // Check cache first
    if (this.searchCache.has(cacheKey)) {
      const cached = this.searchCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        logger.debug('Using cached news results');
        return cached.results;
      }
    }
    
    let results = [];
    
    try {
      if (this.provider === 'BING' && this.bingApiKey) {
        results = await this.searchBingNews(keywords);
      } else if (this.provider === 'NEWSAPI' && this.newsApiKey) {
        results = await this.searchNewsAPI(keywords);
      } else {
        logger.warn('No valid news API configuration found');
        return [];
      }
      
      // Cache results
      this.searchCache.set(cacheKey, {
        results,
        timestamp: Date.now()
      });
      
      return results;
      
    } catch (error) {
      logger.error('News search failed:', error);
      return [];
    }
  }
  
  // Search using Bing News API
  async searchBingNews(keywords) {
    const query = keywords.join(' OR ');
    const params = {
      q: query,
      count: 50,
      offset: 0,
      mkt: 'en-IN',
      safeSearch: 'Off',
      freshness: 'Month', // Last month
      sortBy: 'Relevance'
    };
    
    const response = await axios.get(this.bingBaseUrl, {
      headers: {
        'Ocp-Apim-Subscription-Key': this.bingApiKey
      },
      params,
      timeout: 10000
    });
    
    return response.data.value.map(article => ({
      title: article.name,
      description: article.description,
      url: article.url,
      publishedAt: new Date(article.datePublished),
      source: article.provider[0]?.name || 'Unknown',
      category: article.category || 'General'
    }));
  }
  
  // Search using NewsAPI
  async searchNewsAPI(keywords) {
    const query = keywords.join(' OR ');
    const params = {
      q: query,
      language: 'en',
      sortBy: 'relevancy',
      pageSize: 50,
      from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Last 30 days
      domains: 'timesofindia.indiatimes.com,indianexpress.com,thehindu.com,ndtv.com,hindustantimes.com'
    };
    
    const response = await axios.get(this.newsApiBaseUrl, {
      headers: {
        'X-API-Key': this.newsApiKey
      },
      params,
      timeout: 10000
    });
    
    return response.data.articles.map(article => ({
      title: article.title,
      description: article.description,
      url: article.url,
      publishedAt: new Date(article.publishedAt),
      source: article.source.name,
      category: 'General'
    }));
  }
  
  // Analyze news for sensitivity
  analyzeNewsSensitivity(newsResults, aiIntake, jurisdiction) {
    if (!newsResults || newsResults.length === 0) {
      return this.getDefaultNewsSignals();
    }
    
    let score = 0;
    let geoMatch = false;
    let politicalSensitivity = false;
    let publicOrderConcern = false;
    const relevantSources = [];
    
    // Keywords that indicate high sensitivity
    const highSensitivityKeywords = [
      'riot', 'protest', 'communal', 'tension', 'violence', 'clash',
      'mob', 'lynch', 'encounter', 'custodial', 'political', 'election',
      'corruption', 'scam', 'scandal', 'controversy'
    ];
    
    const mediumSensitivityKeywords = [
      'arrest', 'raid', 'investigation', 'charge', 'accused', 'court',
      'judge', 'lawyer', 'police', 'case', 'verdict', 'sentence'
    ];
    
    // Analyze each article
    for (const article of newsResults) {
      const content = `${article.title} ${article.description}`.toLowerCase();
      const publishedDays = (Date.now() - article.publishedAt.getTime()) / (1000 * 60 * 60 * 24);
      
      // Recency factor (more recent = higher score)
      let articleScore = Math.max(0, 10 - publishedDays);
      
      // Content sensitivity analysis
      let contentSensitivity = 0;
      
      for (const keyword of highSensitivityKeywords) {
        if (content.includes(keyword)) {
          contentSensitivity += 3;
          
          if (['riot', 'communal', 'violence', 'political'].includes(keyword)) {
            politicalSensitivity = true;
          }
          
          if (['riot', 'mob', 'clash', 'violence'].includes(keyword)) {
            publicOrderConcern = true;
          }
        }
      }
      
      for (const keyword of mediumSensitivityKeywords) {
        if (content.includes(keyword)) {
          contentSensitivity += 1;
        }
      }
      
      articleScore *= (1 + contentSensitivity / 10);
      
      // Geographic relevance
      if (jurisdiction) {
        const jurisdictionKeywords = jurisdiction.toLowerCase().split(' ');
        for (const keyword of jurisdictionKeywords) {
          if (keyword.length > 2 && content.includes(keyword)) {
            geoMatch = true;
            articleScore *= 1.5;
            break;
          }
        }
      }
      
      // Add to relevant sources if significant
      if (articleScore > 5) {
        relevantSources.push({
          title: article.title,
          url: article.url,
          publishedAt: article.publishedAt,
          snippet: article.description?.substring(0, 200) || '',
          relevanceScore: Math.min(articleScore / 20, 1)
        });
      }
      
      score += articleScore;
    }
    
    // Normalize score to 0-100
    score = Math.min(score, 100);
    
    // Apply urgency-based multiplier
    if (aiIntake.urgency === 'URGENT') {
      score *= 1.3;
    } else if (aiIntake.urgency === 'LOW') {
      score *= 0.7;
    }
    
    // Risk signals boost
    if (aiIntake.riskSignals && aiIntake.riskSignals.length > 0) {
      score *= 1.2;
    }
    
    // Cap final score
    score = Math.min(Math.round(score), 100);
    
    return {
      sources: relevantSources.slice(0, 10), // Top 10 most relevant
      score,
      geoMatch,
      politicalSensitivity,
      publicOrderConcern
    };
  }
  
  // Get default news signals when no news found or on error
  getDefaultNewsSignals() {
    return {
      sources: [],
      score: 0,
      geoMatch: false,
      politicalSensitivity: false,
      publicOrderConcern: false
    };
  }
  
  // Determine if urgency should be escalated based on news
  shouldEscalateUrgency(newsSignals, currentUrgency) {
    const { score, politicalSensitivity, publicOrderConcern } = newsSignals;
    
    // Escalation thresholds
    const escalationRules = [
      {
        condition: score >= 80 && (politicalSensitivity || publicOrderConcern),
        from: ['LOW', 'MODERATE'],
        to: 'URGENT',
        reason: 'High news sensitivity with political/public order concerns'
      },
      {
        condition: score >= 60 && publicOrderConcern,
        from: ['LOW'],
        to: 'MODERATE',
        reason: 'Moderate news sensitivity with public order concerns'
      },
      {
        condition: score >= 70,
        from: ['LOW'],
        to: 'MODERATE',
        reason: 'High news sensitivity score'
      }
    ];
    
    for (const rule of escalationRules) {
      if (rule.condition && rule.from.includes(currentUrgency)) {
        return {
          shouldEscalate: true,
          newUrgency: rule.to,
          reason: rule.reason
        };
      }
    }
    
    return {
      shouldEscalate: false,
      newUrgency: currentUrgency,
      reason: null
    };
  }
  
  // Clean up cache periodically
  cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.searchCache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.searchCache.delete(key);
      }
    }
  }
  
  // Get service health status
  async getHealthStatus() {
    const status = {
      provider: this.provider,
      configured: false,
      accessible: false,
      cacheSize: this.searchCache.size
    };
    
    if (this.provider === 'BING' && this.bingApiKey) {
      status.configured = true;
      
      try {
        await axios.get(`${this.bingBaseUrl}?q=test&count=1`, {
          headers: { 'Ocp-Apim-Subscription-Key': this.bingApiKey },
          timeout: 5000
        });
        status.accessible = true;
      } catch (error) {
        status.error = error.message;
      }
    } else if (this.provider === 'NEWSAPI' && this.newsApiKey) {
      status.configured = true;
      
      try {
        await axios.get(`${this.newsApiBaseUrl}?q=test&pageSize=1`, {
          headers: { 'X-API-Key': this.newsApiKey },
          timeout: 5000
        });
        status.accessible = true;
      } catch (error) {
        status.error = error.message;
      }
    }
    
    return status;
  }
}

module.exports = new NewsSensitivityService();
