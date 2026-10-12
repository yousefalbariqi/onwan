import { usePageContext } from '../context/PageContext';
import { PageView } from './PageView';

// Live preview of the unsaved draft (PAGE-07).
export function PagePreview() {
  const { pageData } = usePageContext();

  return <PageView data={pageData} variant="preview" />;
}
