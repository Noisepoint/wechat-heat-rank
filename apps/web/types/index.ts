export interface Article {
  id: string;
  title: string;
  cover: string | null;
  pub_time: string;
  url: string;
  tags: string[];
  account: Account;
  proxy_heat: number;
}

export interface Account {
  id: string;
  name: string;
  biz_id: string;
  seed_url: string;
  star: number;
  is_active: boolean;
  last_fetched?: string | null;
  article_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ArticleResponse {
  items: Article[];
  total: number;
  hasMore: boolean;
}

export interface ArticleQueryParams {
  window?: string;
  tags?: string;
  account?: string;
  sort?: string;
  limit?: number;
  offset?: number;
  search?: string;
}

export interface FilterState {
  window: string;
  selectedTags: string[];
  account?: string;
  sort: string;
  search: string;
}

export interface PaginationState {
  current: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface ArticleListState {
  articles: Article[];
  loading: boolean;
  error: string | null;
  pagination: PaginationState;
}

export interface AddAccountRequest {
  seed_url: string;
  star: number;
}

export interface AddAccountResponse {
  id: string;
  name: string;
  biz_id: string;
  seed_url: string;
  star: number;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  last_fetched: string | null;
  article_count: number;
}

export interface ImportResult {
  inserted: number;
  skipped: number;
  errors: Array<{
    row: number;
    reason: string;
  }>;
}

export interface AccountFormData {
  seed_url: string;
  star: number;
}

export interface FormValidationError {
  field: string;
  message: string;
}