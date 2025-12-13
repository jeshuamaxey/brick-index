-- Set up auth and profiles

-- Function to automatically create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for searches
CREATE POLICY "Users can view their own searches"
  ON searches FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can create their own searches"
  ON searches FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update their own searches"
  ON searches FOR UPDATE
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can delete their own searches"
  ON searches FOR DELETE
  USING (auth.uid() = profile_id);

-- RLS Policies for search_results
CREATE POLICY "Users can view their own search results"
  ON search_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM searches
      WHERE searches.id = search_results.search_id
      AND searches.profile_id = auth.uid()
    )
  );

