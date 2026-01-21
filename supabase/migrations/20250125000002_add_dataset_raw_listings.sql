-- Add dataset_raw_listings table to track raw_listings in datasets

-- Create dataset_raw_listings junction table in public schema
CREATE TABLE public.dataset_raw_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID REFERENCES public.datasets(id) ON DELETE CASCADE NOT NULL,
  raw_listing_id UUID REFERENCES pipeline.raw_listings(id) ON DELETE CASCADE NOT NULL,
  added_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(dataset_id, raw_listing_id)
);

-- Create indexes for efficient queries
CREATE INDEX idx_dataset_raw_listings_dataset_id ON public.dataset_raw_listings(dataset_id);
CREATE INDEX idx_dataset_raw_listings_raw_listing_id ON public.dataset_raw_listings(raw_listing_id);
CREATE INDEX idx_dataset_raw_listings_dataset_raw_listing ON public.dataset_raw_listings(dataset_id, raw_listing_id);

-- Add comments
COMMENT ON TABLE public.dataset_raw_listings IS 'Junction table linking datasets to raw_listings, allowing datasets to track listings at the raw stage';
COMMENT ON COLUMN public.dataset_raw_listings.added_at IS 'Timestamp when raw_listing was added to dataset';

-- Enable Row Level Security
ALTER TABLE public.dataset_raw_listings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for dataset_raw_listings
CREATE POLICY "Users can view dataset_raw_listings for their datasets"
  ON public.dataset_raw_listings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.datasets
      WHERE datasets.id = dataset_raw_listings.dataset_id
      AND datasets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert dataset_raw_listings for their datasets"
  ON public.dataset_raw_listings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.datasets
      WHERE datasets.id = dataset_raw_listings.dataset_id
      AND datasets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete dataset_raw_listings for their datasets"
  ON public.dataset_raw_listings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.datasets
      WHERE datasets.id = dataset_raw_listings.dataset_id
      AND datasets.user_id = auth.uid()
    )
  );
