/**
 * Braille Autocorrect and Suggestion System
 * 
 * This system provides real-time autocorrect functionality for Braille input
 * using QWERTY keyboard mapping (D,W,Q,K,O,P for dots 1,2,3,4,5,6)
 */

class BrailleAutocorrect {
    constructor() {
        // QWERTY to Braille dot mapping
        this.keyToDot = {
            'D': 1, 'W': 2, 'Q': 3,  // Top row: dots 1,2,3
            'K': 4, 'O': 5, 'P': 6   // Bottom row: dots 4,5,6
        };
        
        // Braille letter patterns (dots that should be raised)
        this.braillePatterns = {
            'A': [1], 'B': [1,2], 'C': [1,4], 'D': [1,4,5], 'E': [1,5],
            'F': [1,2,4], 'G': [1,2,4,5], 'H': [1,2,5], 'I': [2,4], 'J': [2,4,5],
            'K': [1,3], 'L': [1,2,3], 'M': [1,3,4], 'N': [1,3,4,5], 'O': [1,3,5],
            'P': [1,2,3,4], 'Q': [1,2,3,4,5], 'R': [1,2,3,5], 'S': [2,3,4], 'T': [2,3,4,5],
            'U': [1,3,6], 'V': [1,2,3,6], 'W': [2,4,5,6], 'X': [1,3,4,6], 'Y': [1,3,4,5,6], 'Z': [1,3,5,6]
        };
        
        // Create reverse mapping: pattern to letter
        this.patternToLetter = {};
        for (let [letter, pattern] of Object.entries(this.braillePatterns)) {
            let key = pattern.sort().join(',');
            this.patternToLetter[key] = letter;
        }
        
        // Sample dictionary of common words
        this.dictionary = [
            'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER',
            'WAS', 'ONE', 'OUR', 'HAD', 'HAVE', 'WHAT', 'WERE', 'THEY', 'WE', 'BEEN',
            'THEIR', 'SAID', 'EACH', 'WHICH', 'THERE', 'HOW', 'IF', 'WILL', 'UP',
            'OTHER', 'ABOUT', 'OUT', 'MANY', 'THEN', 'THEM', 'THESE', 'SO', 'SOME',
            'TIME', 'VERY', 'WHEN', 'MUCH', 'NEW', 'WOULD', 'THERE', 'EACH', 'MAKE',
            'LIKE', 'INTO', 'HIM', 'HAS', 'TWO', 'MORE', 'GO', 'NO', 'WAY', 'COULD',
            'MY', 'THAN', 'FIRST', 'WATER', 'LONG', 'LITTLE', 'WHO', 'OIL', 'ITS',
            'NOW', 'FIND', 'DOWN', 'DAY', 'DID', 'GET', 'COME', 'MADE', 'MAY', 'PART'
        ];
        
        // User input history for learning (bonus feature)
        this.userHistory = new Map();
        
        // Cache for performance optimization
        this.suggestionCache = new Map();
    }
    
    /**
     * Convert QWERTY key combination to Braille dots
     * Example: "DK" -> [1,4] (dots 1 and 4)
     */
    keysToDots(keys) {
        let dots = [];
        for (let key of keys.toUpperCase()) {
            if (this.keyToDot[key]) {
                dots.push(this.keyToDot[key]);
            }
        }
        return dots.sort(); // Sort for consistent comparison
    }
    
    /**
     * Convert Braille dots to letter
     * Example: [1,4] -> "C"
     */
    dotsToLetter(dots) {
        let key = dots.sort().join(',');
        return this.patternToLetter[key] || '?';
    }
    
    /**
     * Convert QWERTY input directly to letter
     * Example: "DK" -> "C"
     */
    keysToLetter(keys) {
        let dots = this.keysToDots(keys);
        return this.dotsToLetter(dots);
    }
    
    /**
     * Calculate Levenshtein distance between two strings
     * This measures the minimum number of single-character edits needed
     */
    levenshteinDistance(str1, str2) {
        const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
        
        // Initialize first row and column
        for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
        
        // Fill the matrix
        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,     // deletion
                    matrix[j - 1][i] + 1,     // insertion
                    matrix[j - 1][i - 1] + cost // substitution
                );
            }
        }
        
        return matrix[str2.length][str1.length];
    }
    
    /**
     * Calculate similarity score between Braille patterns
     * This considers both letter similarity and dot pattern similarity
     */
    calculateSimilarity(input, target) {
        // Convert both to letter representation for comparison
        let inputLetters = this.parseInput(input);
        let targetLetters = target;
        
        // Calculate letter-based distance
        let letterDistance = this.levenshteinDistance(inputLetters, targetLetters);
        
        // Calculate pattern-based similarity (bonus points for similar dot patterns)
        let patternSimilarity = this.calculatePatternSimilarity(input, target);
        
        // Combine scores (lower is better)
        return letterDistance - (patternSimilarity * 0.3);
    }
    
    /**
     * Calculate pattern similarity bonus for similar dot arrangements
     */
    calculatePatternSimilarity(input, target) {
        let inputWords = input.split(' ');
        let targetWord = target;
        
        if (inputWords.length !== 1) return 0; // Only works for single words
        
        let similarity = 0;
        let minLength = Math.min(inputWords[0].length, targetWord.length);
        
        for (let i = 0; i < minLength; i++) {
            let inputChar = inputWords[0][i];
            let targetChar = targetWord[i];
            
            if (inputChar === '?') continue; // Skip unrecognized characters
            
            // Get dot patterns for both characters
            let inputDots = this.braillePatterns[inputChar] || [];
            let targetDots = this.braillePatterns[targetChar] || [];
            
            // Calculate dot overlap
            let commonDots = inputDots.filter(dot => targetDots.includes(dot)).length;
            let totalDots = new Set([...inputDots, ...targetDots]).size;
            
            if (totalDots > 0) {
                similarity += commonDots / totalDots;
            }
        }
        
        return similarity;
    }
    
    /**
     * Parse raw input to convert key combinations to letters
     * Example: "DK WQO" -> "C F"
     */
    parseInput(input) {
        let words = input.split(' ');
        let result = [];
        
        for (let word of words) {
            if (word.trim() === '') {
                result.push(' ');
                continue;
            }
            
            // For now, assume each "word" is a single character's key combination
            // In a real implementation, you'd need more sophisticated parsing
            let letter = this.keysToLetter(word);
            result.push(letter);
        }
        
        return result.join('');
    }
    
    /**
     * Get suggestions for misspelled input
     * Returns top N suggestions ranked by similarity
     */
    getSuggestions(input, maxSuggestions = 5) {
        // Check cache first for performance
        let cacheKey = input + '_' + maxSuggestions;
        if (this.suggestionCache.has(cacheKey)) {
            return this.suggestionCache.get(cacheKey);
        }
        
        let suggestions = [];
        
        // Calculate similarity scores for all dictionary words
        for (let word of this.dictionary) {
            let similarity = this.calculateSimilarity(input, word);
            suggestions.push({
                word: word,
                score: similarity,
                confidence: Math.max(0, 1 - (similarity / Math.max(input.length, word.length)))
            });
        }
        
        // Sort by similarity (lower score = more similar)
        suggestions.sort((a, b) => a.score - b.score);
        
        // Apply user history bonus (learning feature)
        suggestions = this.applyUserHistoryBonus(suggestions, input);
        
        // Take top suggestions
        let result = suggestions.slice(0, maxSuggestions);
        
        // Cache the result
        this.suggestionCache.set(cacheKey, result);
        
        return result;
    }
    
    /**
     * Apply learning bonus based on user's previous choices
     */
    applyUserHistoryBonus(suggestions, input) {
        for (let suggestion of suggestions) {
            let historyKey = input + '->' + suggestion.word;
            if (this.userHistory.has(historyKey)) {
                let frequency = this.userHistory.get(historyKey);
                suggestion.score -= frequency * 0.5; // Boost frequently chosen corrections
                suggestion.confidence += frequency * 0.1;
            }
        }
        
        return suggestions.sort((a, b) => a.score - b.score);
    }
    
    /**
     * Learn from user's correction choice
     */
    learnFromCorrection(originalInput, chosenCorrection) {
        let historyKey = originalInput + '->' + chosenCorrection;
        let currentCount = this.userHistory.get(historyKey) || 0;
        this.userHistory.set(historyKey, currentCount + 1);
        
        // Clear related cache entries to incorporate learning
        for (let [key, value] of this.suggestionCache.entries()) {
            if (key.startsWith(originalInput)) {
                this.suggestionCache.delete(key);
            }
        }
    }
    
    /**
     * Process real-time input and provide immediate feedback
     */
    processRealTimeInput(input) {
        if (!input || input.trim() === '') {
            return { parsed: '', suggestions: [], isValid: true };
        }
        
        let parsed = this.parseInput(input);
        let hasUnknownChars = parsed.includes('?');
        
        let result = {
            parsed: parsed,
            suggestions: [],
            isValid: !hasUnknownChars,
            rawInput: input
        };
        
        // If there are unknown characters or it's not a dictionary word, get suggestions
        if (hasUnknownChars || !this.dictionary.includes(parsed.toUpperCase())) {
            result.suggestions = this.getSuggestions(input);
        }
        
        return result;
    }
    
    /**
     * Get detailed analysis of input for debugging/learning
     */
    analyzeInput(input) {
        let analysis = {
            rawInput: input,
            keyPresses: input.split(' '),
            dotPatterns: [],
            letters: [],
            possibleWords: []
        };
        
        for (let keyCombo of analysis.keyPresses) {
            if (keyCombo.trim() === '') continue;
            
            let dots = this.keysToDots(keyCombo);
            let letter = this.dotsToLetter(dots);
            
            analysis.dotPatterns.push(dots);
            analysis.letters.push(letter);
        }
        
        analysis.word = analysis.letters.join('');
        analysis.suggestions = this.getSuggestions(input, 3);
        
        return analysis;
    }
}

// Example usage and testing
function demonstrateSystem() {
    console.log("=== Braille Autocorrect System Demo ===\n");
    
    let autocorrect = new BrailleAutocorrect();
    
    // Test basic letter recognition
    console.log("1. Basic Letter Recognition:");
    console.log("DK -> " + autocorrect.keysToLetter("DK")); // Should be 'C'
    console.log("D -> " + autocorrect.keysToLetter("D"));   // Should be 'A'
    console.log("DWQ -> " + autocorrect.keysToLetter("DWQ")); // Should be 'L'
    console.log("");
    
    // Test word suggestions
    console.log("2. Word Suggestions:");
    let testInputs = [
        "D DWQK",        // "A ???" - should suggest words starting with A
        "DWQKO D",       // "??? A" - might be "THE"
        "DW QK O",       // Might be attempting "THE"
    ];
    
    for (let input of testInputs) {
        console.log(`Input: "${input}"`);
        let result = autocorrect.processRealTimeInput(input);
        console.log(`Parsed: "${result.parsed}"`);
        console.log("Suggestions:");
        for (let i = 0; i < Math.min(3, result.suggestions.length); i++) {
            let suggestion = result.suggestions[i];
            console.log(`  ${i+1}. ${suggestion.word} (confidence: ${(suggestion.confidence * 100).toFixed(1)}%)`);
        }
        console.log("");
    }
    
    // Test learning mechanism
    console.log("3. Learning Mechanism:");
    autocorrect.learnFromCorrection("D DWQK", "AND");
    console.log("After learning 'D DWQK' -> 'AND':");
    let learnResult = autocorrect.processRealTimeInput("D DWQK");
    for (let i = 0; i < Math.min(3, learnResult.suggestions.length); i++) {
        let suggestion = learnResult.suggestions[i];
        console.log(`  ${i+1}. ${suggestion.word} (confidence: ${(suggestion.confidence * 100).toFixed(1)}%)`);
    }
    console.log("");
    
    // Performance demonstration
    console.log("4. Performance Test:");
    let startTime = performance.now();
    for (let i = 0; i < 1000; i++) {
        autocorrect.getSuggestions("DWQ K");
    }
    let endTime = performance.now();
    console.log(`1000 suggestion queries completed in ${(endTime - startTime).toFixed(2)}ms`);
    console.log(`Average: ${((endTime - startTime) / 1000).toFixed(3)}ms per query`);
}

// Run demonstration
if (typeof window !== 'undefined') {
    // Browser environment
    window.BrailleAutocorrect = BrailleAutocorrect;
    window.demonstrateSystem = demonstrateSystem;
    console.log("Braille Autocorrect System loaded. Run demonstrateSystem() to see examples.");
} else {
    // Node.js environment
    demonstrateSystem();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BrailleAutocorrect;
}