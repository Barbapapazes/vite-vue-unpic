import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { MagicString } from 'vue/compiler-sfc'
import { cwd } from 'node:process'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { encode } from "blurhash";
import { getPixels } from '@unpic/pixels'
import { blurhashToDataUri } from "@unpic/placeholder";
import inspect from 'vite-plugin-inspect'


export default defineConfig({
  plugins: [
    inspect(),
    vue(),
    (() => {
      const publicDir = join(cwd(), 'public')
      return {
        name: 'unpic',
        enforce: 'pre',
        async transform(code, id) {
          if (!id.endsWith('.vue')) return

          const s = new MagicString(code)

          const imgTagRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/g
          let match = imgTagRegex.exec(code)

          if (!match) {
            return {
              code,
              map: null
            }
          }

          do {
            const srcValue = match[1]

            const img = await readFile(join(publicDir, srcValue))
            const data = await getPixels(img)
            const blurhash = encode(Uint8ClampedArray.from(data.data), data.width, data.height, 4, 4)

            const imgTagStart = match.index
            const imgTagEnd = imgTagStart + match[0].length

            const newImgTag = match[0].replace(
              /<img(\s+)/,
              `<img$1width="${data.width}" height="${data.height}" style="background-size: cover; background-image: url(${blurhashToDataUri(blurhash)});" loading="lazy" `
            )

            s.overwrite(imgTagStart, imgTagEnd, newImgTag)

            match = imgTagRegex.exec(code)
          } while (match !== null)

          return {
            code: s.toString(),
            map: s.generateMap({ hires: true })
          }
        }
      }
    })()
  ],
})
