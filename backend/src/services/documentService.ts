import { createClient } from '@supabase/supabase-js';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParsePkg = require('pdf-parse');
import mammoth from 'mammoth';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Extract text from a document stored in Supabase Storage.
 * Supports PDF and DOCX. Returns null for unsupported formats (PPT, PPTX, DOC).
 */
export async function extractDocumentText(storagePath: string): Promise<string | null> {
    if (!supabaseServiceKey) {
        console.warn('SUPABASE_SERVICE_ROLE_KEY not set — cannot extract document text');
        return null;
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await serviceClient.storage
        .from('venture-documents')
        .download(storagePath);

    if (error || !data) {
        console.error('Failed to download document from storage:', error);
        return null;
    }

    const extension = storagePath.split('.').pop()?.toLowerCase();
    const buffer = Buffer.from(await data.arrayBuffer());

    try {
        if (extension === 'pdf') {
            const result = await pdfParsePkg(buffer);
            return result.text;
        }

        if (extension === 'docx') {
            const result = await mammoth.extractRawText({ buffer });
            return result.value;
        }

        // PPT, PPTX, DOC — text extraction not available
        return null;
    } catch (err) {
        console.error(`Failed to extract text from ${extension} file:`, err);
        return null;
    }
}
