/**
 * TESTE SIMPLES: Upload para MinIO
 *
 * Teste direto de upload sem outros requests que possam causar rate limiting
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_BASE = 'http://localhost:3000';
const API_KEY = 'test-key-local-12345';

async function uploadFile() {
  try {
    console.log('Starting MinIO upload test...\n');

    // Create test image
    const jpegBase64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8VAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=';
    const buffer = Buffer.from(jpegBase64, 'base64');

    const testDir = './test-artifacts';
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    const filepath = path.join(testDir, `minio-test-${Date.now()}.jpg`);
    fs.writeFileSync(filepath, buffer);

    console.log(`✅ Test image created: ${filepath} (${buffer.length} bytes)\n`);

    // Create form data
    const form = new FormData();
    form.append('image', fs.createReadStream(filepath), 'test-minio.jpg');
    form.append('workflow', 'catalog');

    console.log('📤 Uploading to /ai/submit...');
    console.log(`   Endpoint: ${API_BASE}/ai/submit`);
    console.log(`   Storage Backend: MinIO\n`);

    const startTime = Date.now();

    const response = await axios.post(
      `${API_BASE}/ai/submit`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${API_KEY}`,
        },
        timeout: 300000, // 5 minutes
      }
    );

    const elapsed = Date.now() - startTime;

    console.log(`✅ Upload successful!\n`);
    console.log(`Status: ${response.status}`);
    console.log(`Response:`);
    console.log(`  Job ID: ${response.data.job_id}`);
    console.log(`  Status: ${response.data.status}`);
    console.log(`  Message: ${response.data.message}`);
    console.log(`\n⏱️  Time elapsed: ${elapsed}ms\n`);

    // Cleanup
    fs.unlinkSync(filepath);
    console.log('✅ Cleanup complete');

  } catch (error) {
    console.log(`❌ Upload failed!\n`);
    console.log(`Error: ${error.message}`);

    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log(`Data:`, error.response.data);
    }

    process.exit(1);
  }
}

uploadFile();
