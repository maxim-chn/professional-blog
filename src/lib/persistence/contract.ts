import type { Post } from './models/post.ts';
import type { PostContent } from './models/post-content.ts';
import type { PostMedia } from './models/post-media.ts';
import type { PostMetadata } from './models/post-metadata.ts';
import type { PostRegistry } from './models/post-registry.ts';

export interface PostBundle {
  post: Post;
  metadata: PostMetadata;
  contents: PostContent[];
  media: PostMedia[];
}
export type CreateResult = { post_id: string; post_metadata_id: string } & (
  { created: true; duplicate: false } | { created: false; duplicate: true }
);
export interface ListResult {
  items: { post_id: string; metadata: PostMetadata }[];
  next_cursor: string | null;
}
export interface PersistenceAdapter {
  create(bundle: PostBundle, registry: PostRegistry): Promise<CreateResult>;
  listPosts(limit: number, cursor?: string | null): Promise<ListResult>;
  getPost(postId: string): Promise<PostBundle>;
}
