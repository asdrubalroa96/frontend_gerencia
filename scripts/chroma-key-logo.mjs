/**
 * Convierte píxeles casi negros del logo en transparentes (fondo del PNG).
 * Ejecutar: node scripts/chroma-key-logo.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = path.join(root, 'public', 'seniat-logo.png');
const backup = path.join(root, 'public', 'seniat-logo.pre-chroma.png');

/** Píxeles con RGB por debajo de este umbral pasan a alpha 0 (fondo negro). */
const THRESH = 42;

async function main() {
  if (!fs.existsSync(input)) {
    console.error('No existe:', input);
    process.exit(1);
  }
  fs.copyFileSync(input, backup);

  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (channels !== 4) {
    console.error('Se esperaba RGBA');
    process.exit(1);
  }
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r <= THRESH && g <= THRESH && b <= THRESH) {
      data[i + 3] = 0;
    }
  }
  await sharp(data, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(input + '.tmp');
  fs.renameSync(input + '.tmp', input);
  console.log('Listo. Original respaldado en public/seniat-logo.pre-chroma.png');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
