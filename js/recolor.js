/**
 * recolor.js
 * ------------------------------------------------------------------
 * Modular clothing-recoloring system for raster character art.
 *
 * Approach:
 *  - Each character has a grayscale "mask" image: white/bright =
 *    recolorable clothing region, black = everything else (skin,
 *    hair, armor, accessories).
 *  - At render time we build a tinted overlay whose alpha channel is
 *    taken from the mask's brightness, then composite it onto the
 *    base illustration using the canvas 'color' blend mode. That
 *    blend mode replaces hue+saturation while KEEPING the backdrop's
 *    luminosity — which is exactly what preserves shading and
 *    highlights on the original painted artwork.
 *  - Nothing outside the mask (skin, hair, other clothing items,
 *    armor) is touched.
 *  - No images are generated at runtime; only canvas compositing of
 *    the pre-existing assets.
 *
 * Fallback:
 *  - If a character has no mask asset (or it fails to load), the
 *    character is rendered unmodified at its default appearance.
 *    This keeps the architecture ready for manually-prepared masks
 *    or separate clothing layers to be dropped in later without any
 *    code changes beyond characterConfig.js.
 * ------------------------------------------------------------------
 */

const imageCache = new Map(); // src -> Promise<HTMLImageElement>
const renderCache = new Map(); // `${asset}|${mask}|${colorHex}` -> Promise<string dataURL>

function loadImage(src) {
  if (imageCache.has(src)) return imageCache.get(src);
  const promise = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
  imageCache.set(src, promise);
  return promise;
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return { r, g, b };
}

/**
 * Build a recolored character image as a data URL (cached).
 * @param {string} assetSrc path to base character illustration
 * @param {string|null} maskSrc path to grayscale clothing mask, or null
 * @param {string} colorHex target clothing color, e.g. "#3498db"
 * @returns {Promise<string>} data URL of the composited PNG
 */
export async function getRecoloredImage(assetSrc, maskSrc, colorHex) {
  const cacheKey = `${assetSrc}|${maskSrc}|${colorHex}`;
  if (renderCache.has(cacheKey)) return renderCache.get(cacheKey);

  const promise = (async () => {
    const baseImg = await loadImage(assetSrc);

    const canvas = document.createElement('canvas');
    canvas.width = baseImg.naturalWidth;
    canvas.height = baseImg.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(baseImg, 0, 0);

    if (maskSrc) {
      try {
        const maskImg = await loadImage(maskSrc);

        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = canvas.width;
        maskCanvas.height = canvas.height;
        const maskCtx = maskCanvas.getContext('2d');
        maskCtx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);

        const maskData = maskCtx.getImageData(0, 0, canvas.width, canvas.height);
        const { r, g, b } = hexToRgb(colorHex);
        const px = maskData.data;
        for (let i = 0; i < px.length; i += 4) {
          const intensity = px[i]; // grayscale, R=G=B
          px[i] = r;
          px[i + 1] = g;
          px[i + 2] = b;
          px[i + 3] = intensity; // use mask brightness as alpha
        }
        maskCtx.putImageData(maskData, 0, 0);

        ctx.save();
        ctx.globalCompositeOperation = 'color';
        ctx.drawImage(maskCanvas, 0, 0);
        ctx.restore();

        // Boost: lift brightness and saturation of the recolored clothing so the new color reads clearly.
        ctx.save();
        ctx.globalCompositeOperation = 'soft-light';
        ctx.globalAlpha = 0.9;
        ctx.drawImage(maskCanvas, 0, 0);
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.18;
        ctx.drawImage(maskCanvas, 0, 0);
        ctx.restore();

        // Re-apply original silhouette alpha so the color blend never
        // bleeds a faint tint outside the character's own edges.
        ctx.save();
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(baseImg, 0, 0);
        ctx.restore();
      } catch (e) {
        // Mask failed to load — fall back silently to unrecolored art.
        console.warn(`Recolor mask unavailable for ${assetSrc}, using default colors.`, e);
      }
    }

    return canvas.toDataURL('image/png');
  })();

  renderCache.set(cacheKey, promise);
  return promise;
}

/** Pre-warm the cache for a list of {asset, mask, colorHex} descriptors. */
export function prewarmRecolor(descriptors) {
  return Promise.all(
    descriptors.map((d) => getRecoloredImage(d.asset, d.mask, d.colorHex).catch(() => null))
  );
}
