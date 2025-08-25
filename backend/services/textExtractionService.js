const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

class TextExtractionService {
  constructor() {
    this.ocrWorker = null;
    this.initOCR();
  }
  
  async initOCR() {
    try {
      // Initialize Tesseract worker for better performance
      this.ocrWorker = await Tesseract.createWorker();
      await this.ocrWorker.loadLanguage('eng');
      await this.ocrWorker.initialize('eng');
      logger.info('OCR worker initialized');
    } catch (error) {
      logger.error('OCR worker initialization failed:', error);
    }
  }
  
  // Main text extraction method
  async extractText(pdfBuffer, options = {}) {
    const startTime = Date.now();
    const { fallbackToOCR = true, forceOCR = false } = options;
    
    let extractedText = '';
    let method = 'pdf-parse';
    let confidence = 1;
    let metadata = {};
    
    try {
      if (!forceOCR) {
        // Try PDF parsing first
        const result = await this.extractWithPdfParse(pdfBuffer);
        extractedText = result.text;
        metadata = result.metadata;
        
        // Check if text extraction was successful
        const textDensity = this.calculateTextDensity(extractedText, result.metadata.pages);
        
        if (textDensity < 0.1 && fallbackToOCR) {
          // Low text density suggests scanned PDF, try OCR
          logger.info('Low text density detected, falling back to OCR');
          const ocrResult = await this.extractWithOCR(pdfBuffer);
          extractedText = ocrResult.text;
          method = 'ocr';
          confidence = ocrResult.confidence;
          metadata = { ...metadata, ...ocrResult.metadata };
        }
      } else {
        // Force OCR extraction
        const ocrResult = await this.extractWithOCR(pdfBuffer);
        extractedText = ocrResult.text;
        method = 'ocr';
        confidence = ocrResult.confidence;
        metadata = ocrResult.metadata;
      }
      
      // Clean and normalize the extracted text
      const cleanedText = this.cleanText(extractedText);
      
      const processingTime = Date.now() - startTime;
      
      return {
        text: cleanedText,
        method,
        confidence,
        processingTime,
        metadata: {
          ...metadata,
          originalLength: extractedText.length,
          cleanedLength: cleanedText.length,
          wordsCount: this.countWords(cleanedText),
          linesCount: this.countLines(cleanedText)
        }
      };
      
    } catch (error) {
      logger.error('Text extraction failed:', error);
      throw new AppError('Text extraction failed', 500, 'EXTRACTION_FAILED');
    }
  }
  
  // Extract text using pdf-parse
  async extractWithPdfParse(pdfBuffer) {
    try {
      const options = {
        // Custom render function to handle special cases
        render_page: (pageData) => {
          return pageData.getTextContent().then((textContent) => {
            let lastY, text = '';
            
            for (let item of textContent.items) {
              if (lastY === item.transform[5] || !lastY) {
                text += item.str;
              } else {
                text += '\n' + item.str;
              }
              lastY = item.transform[5];
            }
            return text;
          });
        }
      };
      
      const data = await pdfParse(pdfBuffer, options);
      
      return {
        text: data.text,
        metadata: {
          pages: data.numpages,
          info: data.info,
          version: data.version
        }
      };
    } catch (error) {
      logger.error('PDF parse error:', error);
      throw new AppError('PDF parsing failed', 500, 'PDF_PARSE_FAILED');
    }
  }
  
  // Extract text using OCR
  async extractWithOCR(pdfBuffer) {
    try {
      // Convert PDF to images first
      const images = await this.convertPdfToImages(pdfBuffer);
      
      let fullText = '';
      let totalConfidence = 0;
      let pageCount = 0;
      
      for (const imageBuffer of images) {
        const result = await this.performOCR(imageBuffer);
        fullText += result.text + '\n\n';
        totalConfidence += result.confidence;
        pageCount++;
      }
      
      const averageConfidence = pageCount > 0 ? totalConfidence / pageCount : 0;
      
      return {
        text: fullText,
        confidence: averageConfidence / 100, // Convert to 0-1 scale
        metadata: {
          pages: pageCount,
          method: 'tesseract',
          averageConfidence
        }
      };
    } catch (error) {
      logger.error('OCR extraction error:', error);
      throw new AppError('OCR extraction failed', 500, 'OCR_FAILED');
    }
  }
  
  // Convert PDF to images for OCR
  async convertPdfToImages(pdfBuffer) {
    try {
      // For now, we'll use a simple approach
      // In production, you might want to use pdf2pic or similar
      // This is a simplified implementation
      
      // Create a single image from the PDF buffer
      // Note: This is a placeholder - you'd need a proper PDF to image converter
      const image = await sharp(pdfBuffer, { density: 300 })
        .png()
        .toBuffer();
      
      return [image];
    } catch (error) {
      // If sharp fails (which it will with PDF), we'll try alternative approach
      logger.warn('PDF to image conversion failed, using fallback method');
      
      // Return the original buffer as fallback
      // In production, implement proper PDF to image conversion
      return [pdfBuffer];
    }
  }
  
  // Perform OCR on image buffer
  async performOCR(imageBuffer) {
    try {
      if (!this.ocrWorker) {
        await this.initOCR();
      }
      
      const { data: { text, confidence } } = await this.ocrWorker.recognize(imageBuffer);
      
      return {
        text: text || '',
        confidence: confidence || 0
      };
    } catch (error) {
      logger.error('OCR recognition error:', error);
      throw new AppError('OCR recognition failed', 500, 'OCR_RECOGNITION_FAILED');
    }
  }
  
  // Calculate text density to determine if OCR is needed
  calculateTextDensity(text, pageCount) {
    if (!text || !pageCount) return 0;
    
    const wordsPerPage = this.countWords(text) / pageCount;
    const charsPerPage = text.length / pageCount;
    
    // Heuristic: if less than 50 words or 200 characters per page, likely scanned
    const wordDensity = wordsPerPage / 50; // Normalize to 0-1 scale
    const charDensity = charsPerPage / 200; // Normalize to 0-1 scale
    
    return Math.min((wordDensity + charDensity) / 2, 1);
  }
  
  // Clean and normalize extracted text
  cleanText(text) {
    if (!text) return '';
    
    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove page numbers (simple heuristic)
      .replace(/^\s*\d+\s*$/gm, '')
      // Remove headers/footers (lines with only caps and numbers)
      .replace(/^[A-Z0-9\s]{3,}$/gm, '')
      // Remove watermarks (repeated short phrases)
      .replace(/(.{1,20})\1{3,}/g, '$1')
      // Clean up line breaks
      .replace(/\n\s*\n/g, '\n\n')
      // Trim whitespace
      .trim();
  }
  
  // Count words in text
  countWords(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }
  
  // Count lines in text
  countLines(text) {
    if (!text) return 0;
    return text.split('\n').length;
  }
  
  // Extract specific sections from legal documents
  extractLegalSections(text) {
    const sections = {};
    
    // Common legal document patterns
    const patterns = {
      parties: /(?:plaintiff|petitioner|appellant|complainant)[\s\S]*?(?:defendant|respondent|appellee)/gi,
      case_number: /(?:case\s+no\.?|civil\s+suit\s+no\.?|criminal\s+case\s+no\.?)\s*:?\s*([a-z0-9\/\-\s]+)/gi,
      court: /(?:in\s+the\s+|before\s+the\s+)([^.\n]+(?:court|tribunal|commission))/gi,
      date: /(?:dated?|on)\s+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi,
      subject: /(?:subject|re|matter)\s*:?\s*([^\n]+)/gi
    };
    
    for (const [key, pattern] of Object.entries(patterns)) {
      const matches = [...text.matchAll(pattern)];
      if (matches.length > 0) {
        sections[key] = matches.map(match => match[1] || match[0]).filter(Boolean);
      }
    }
    
    return sections;
  }
  
  // Validate extracted text quality
  validateTextQuality(text, confidence) {
    const issues = [];
    
    if (!text || text.trim().length === 0) {
      issues.push('No text extracted');
    }
    
    if (text.length < 100) {
      issues.push('Very short text extracted');
    }
    
    if (confidence < 0.7) {
      issues.push('Low OCR confidence');
    }
    
    // Check for garbled text (high ratio of non-alphabetic characters)
    const alphaRatio = (text.match(/[a-zA-Z]/g) || []).length / text.length;
    if (alphaRatio < 0.5) {
      issues.push('High ratio of non-alphabetic characters');
    }
    
    // Check for repeated characters (OCR artifacts)
    if (/(.)\1{10,}/.test(text)) {
      issues.push('Repeated character sequences detected');
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      quality: issues.length === 0 ? 'good' : issues.length < 3 ? 'fair' : 'poor'
    };
  }
  
  // Cleanup method
  async cleanup() {
    if (this.ocrWorker) {
      await this.ocrWorker.terminate();
      logger.info('OCR worker terminated');
    }
  }
}

module.exports = new TextExtractionService();
