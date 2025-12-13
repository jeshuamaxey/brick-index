// Tests for text extractor

import { describe, it, expect } from 'vitest';
import { TextExtractor } from '@/lib/analyze/text-extractor';

describe('TextExtractor', () => {
  const extractor = new TextExtractor();

  describe('extractPieceCount', () => {
    it('should extract stated piece count', () => {
      const result = extractor.extractPieceCount('500 pieces of LEGO');
      expect(result.count).toBe(500);
      expect(result.estimated).toBe(false);
    });

    it('should extract estimated piece count', () => {
      const result = extractor.extractPieceCount('~1000 pieces');
      expect(result.count).toBe(1000);
      expect(result.estimated).toBe(true);
    });

    it('should handle various formats', () => {
      expect(extractor.extractPieceCount('2000 pcs').count).toBe(2000);
      expect(extractor.extractPieceCount('1500 bricks').count).toBe(1500);
      expect(extractor.extractPieceCount('approx 3000 pieces').count).toBe(
        3000
      );
      expect(
        extractor.extractPieceCount('approximately 500 pieces').count
      ).toBe(500);
    });

    it('should return null for no match', () => {
      const result = extractor.extractPieceCount('Just some LEGO');
      expect(result.count).toBeNull();
      expect(result.estimated).toBe(false);
    });

    it('should handle empty string', () => {
      const result = extractor.extractPieceCount('');
      expect(result.count).toBeNull();
      expect(result.estimated).toBe(false);
    });
  });

  describe('extractMinifigCount', () => {
    it('should extract stated minifig count', () => {
      const result = extractor.extractMinifigCount('5 minifigs included');
      expect(result.count).toBe(5);
      expect(result.estimated).toBe(false);
    });

    it('should extract estimated minifig count', () => {
      const result = extractor.extractMinifigCount('~10 minifigs');
      expect(result.count).toBe(10);
      expect(result.estimated).toBe(true);
    });

    it('should handle various formats', () => {
      expect(extractor.extractMinifigCount('3 figs').count).toBe(3);
      expect(extractor.extractMinifigCount('7 minifigures').count).toBe(7);
      expect(extractor.extractMinifigCount('about 15 minifigs').count).toBe(15);
    });

    it('should return null for no match', () => {
      const result = extractor.extractMinifigCount('No minifigs mentioned');
      expect(result.count).toBeNull();
    });
  });

  describe('extractCondition', () => {
    it('should identify new condition', () => {
      expect(extractor.extractCondition('Brand new LEGO')).toBe('new');
      expect(extractor.extractCondition('Sealed box')).toBe('new');
      expect(extractor.extractCondition('Unopened')).toBe('new');
    });

    it('should identify used condition', () => {
      expect(extractor.extractCondition('Used LEGO')).toBe('used');
      expect(extractor.extractCondition('Pre-owned')).toBe('used');
      expect(extractor.extractCondition('Previously owned')).toBe('used');
    });

    it('should return unknown for unclear condition', () => {
      expect(extractor.extractCondition('LEGO bricks')).toBe('unknown');
      expect(extractor.extractCondition('')).toBe('unknown');
    });
  });

  describe('extractAll', () => {
    it('should extract all data from text', () => {
      const text =
        'Large lot of LEGO, approximately 2000 pieces, 5 minifigs, used condition';
      const result = extractor.extractAll(text);

      expect(result.piece_count).toBe(2000);
      expect(result.estimated_piece_count).toBe(true);
      expect(result.minifig_count).toBe(5);
      expect(result.estimated_minifig_count).toBe(false);
      expect(result.condition).toBe('used');
    });
  });
});

