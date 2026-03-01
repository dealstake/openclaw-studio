/**
 * Feedback annotation types for chat message quality tracking.
 *
 * Phase 1: localStorage persistence with gateway RPC stubs for future migration.
 * Phase 2: wire to gateway RPCs (annotations.create / .list / .delete).
 */

export type AnnotationRating = "thumbs_up" | "thumbs_down" | "flag";

export type Annotation = {
  id: string;
  sessionKey: string;
  messageId: string;
  rating: AnnotationRating;
  comment?: string;
  tags?: string[];
  createdAt: number;
};

export type CreateAnnotationParams = {
  sessionKey: string;
  messageId: string;
  rating: AnnotationRating;
  comment?: string;
  tags?: string[];
};

export type ListAnnotationsParams = {
  sessionKey?: string;
  limit?: number;
  offset?: number;
};

export type ListAnnotationsResult = {
  annotations: Annotation[];
  total: number;
};

export type DeleteAnnotationParams = {
  id: string;
};
