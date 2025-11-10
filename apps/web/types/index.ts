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
  star: number;
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