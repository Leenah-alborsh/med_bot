import { ContentManager } from '../../../src/components/content-manager';
import { serverApi } from '../../../src/lib/server-api';
type Item = {
  id: string;
  titleAr: string;
  titleEn?: string;
  sectionId: string;
  bodyText?: string;
  contentType: 'TEXT' | 'LINK' | 'FILE';
  state: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  displayOrder: number;
  section: { nameAr: string; course: { nameAr: string } };
  attachments: Array<{
    id: string;
    storageProvider: 'TELEGRAM' | 'EXTERNAL_URL';
    originalFilename: string;
    externalUrl?: string;
  }>;
};
type Section = { id: string; nameAr: string };
export default async function Page() {
  const [content, sections] = await Promise.all([
    serverApi<{ items: Item[] }>('content?pageSize=100'),
    serverApi<{ items: Section[] }>('catalog/sections?pageSize=100&active=true'),
  ]);
  return <ContentManager items={content.items} sections={sections.items} />;
}
