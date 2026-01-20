-- Add datasets and dataset_listings tables for tracking arbitrary sets of listings

-- Create datasets table in public schema (user-facing data)
CREATE TABLE public.datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Create dataset_listings junction table in public schema
CREATE TABLE public.dataset_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID REFERENCES public.datasets(id) ON DELETE CASCADE NOT NULL,
  listing_id UUID REFERENCES pipeline.listings(id) ON DELETE CASCADE NOT NULL,
  added_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(dataset_id, listing_id)
);

-- Create indexes for efficient queries
CREATE INDEX idx_datasets_user_id ON public.datasets(user_id);
CREATE INDEX idx_datasets_user_id_name ON public.datasets(user_id, name);
CREATE INDEX idx_dataset_listings_dataset_id ON public.dataset_listings(dataset_id);
CREATE INDEX idx_dataset_listings_listing_id ON public.dataset_listings(listing_id);
CREATE INDEX idx_dataset_listings_dataset_listing ON public.dataset_listings(dataset_id, listing_id);

-- Add comments
COMMENT ON TABLE public.datasets IS 'User-specific datasets for tracking arbitrary sets of listings through the pipeline';
COMMENT ON TABLE public.dataset_listings IS 'Junction table linking datasets to listings, allowing many-to-many relationships';
COMMENT ON COLUMN public.datasets.user_id IS 'Owner of the dataset, references auth.users';
COMMENT ON COLUMN public.datasets.name IS 'Dataset name, unique per user';
COMMENT ON COLUMN public.dataset_listings.added_at IS 'Timestamp when listing was added to dataset';

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_datasets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for datasets updated_at
CREATE TRIGGER update_datasets_updated_at 
  BEFORE UPDATE ON public.datasets
  FOR EACH ROW EXECUTE FUNCTION public.update_datasets_updated_at();

-- Enable Row Level Security
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_listings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for datasets
CREATE POLICY "Users can view their own datasets"
  ON public.datasets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own datasets"
  ON public.datasets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own datasets"
  ON public.datasets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own datasets"
  ON public.datasets FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for dataset_listings
CREATE POLICY "Users can view dataset_listings for their datasets"
  ON public.dataset_listings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.datasets
      WHERE datasets.id = dataset_listings.dataset_id
      AND datasets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert dataset_listings for their datasets"
  ON public.dataset_listings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.datasets
      WHERE datasets.id = dataset_listings.dataset_id
      AND datasets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete dataset_listings for their datasets"
  ON public.dataset_listings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.datasets
      WHERE datasets.id = dataset_listings.dataset_id
      AND datasets.user_id = auth.uid()
    )
  );
