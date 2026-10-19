# Background video uploads

Owner-approved limit: **20 MB** per MP4/WebM background video.

The editor previews local files, then uploads directly to Vercel Blob. The
page stores only the final URL and metadata. Upload tokens require an active
owner login, restrict the path to that owner, and enforce the MIME and size
limits. Saving a page verifies the stored video metadata and owner again.

## Activation

1. Connect a **public Vercel Blob store** to this Vercel project.
2. Make `BLOB_READ_WRITE_TOKEN` available in the project's server environment;
   include Development if local API testing is needed. Never prefix it with VITE.
3. Run the API with the environment loaded, or deploy the prepared code.
4. Sign in, choose Background → Video, select a file, preview it, then upload.
   Saving the page is still a separate explicit action.

No store or paid service was provisioned by this implementation. Without the
storage key, the API returns a clear 503 and preserves the existing background.
Vite alone does not run the API. Guest users may preview a selected file but
must sign in to upload it. This upload endpoint currently handles owner sessions;
staff editors need to use the owner's already uploaded asset.

Old videos are retained in storage on replacement/removal so page history and
restoration remain valid. Storage cleanup/retention is a separate pending policy.

Official setup: https://vercel.com/docs/vercel-blob/client-upload
