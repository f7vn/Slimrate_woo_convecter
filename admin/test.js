import { exportFromShopify } from '../../shopify.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

// Импортируем функцию из Woo-скрипта
async function buildSlimrateItemRoot(product, variations) {
    // Загружаем основную картинку товара
    const productImageUrl = product.images?.[0]?.src || '';
    const slimrateProductImage = productImageUrl ? await uploadImageToSlimrate(productImageUrl) : '';
  
    // Для каждой вариации загружаем картинку
    const items = [];
    for (const variation of variations) {
      const varImageUrl = variation?.image?.src || '';
      const slimrateVarImage = varImageUrl ? await uploadImageToSlimrate(varImageUrl) : '';
      // Для wooInfo.pictures (только одна картинка)
      const wooPictures = slimrateVarImage ? [slimrateVarImage] : [];
      items.push({
        varName: variation?.attributes?.map(a => a.option).join(', ') || '',
        price: variation?.regular_price || '',
        image: slimrateVarImage,
        barcode: variation?.meta_data?.find(m => m.key === 'barcode')?.value || '',
        skuCode: variation?.sku || '',
        // cost: variation?.cost || '',
        startQuantity: variation?.stock_quantity != null ? String(variation.stock_quantity) : '',
        toDelete: false,
        wooInfo: {
          name: variation?.name || '',
          description: variation?.description || '',
          shortDescription: variation?.short_description || '',
          pictures: wooPictures
        }
      });
    }
    return {
      displayName: product.name,
      image: slimrateProductImage,
      categoryId: DEFAULT_CATEGORY_ID,
      taxId: DEFAULT_TAX_ID,
      quantityUnitId: DEFAULT_UNIT_ID,
      description: product.description,
      items
    };
  }

const SLIMRATE_URL = process.env.SLIMRATE_URL || 'https://dev.slimrate.com/v1/item-roots/create';
const SLIMRATE_TOKEN = process.env.SLIMRATE_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InRlc3R-MSIsImlhdCI6MTc0NTQzMTU4NywidHlwZSI6NSwiY29tcGFueSI6InRlc3QiLCJyb2xlSWQiOiJ0ZXN0fjEifQ.7B-HmmQkKvuWKyyuNCLg_H8nYnbMZlB_CMTjaqwsGmQ';
const DEFAULT_CATEGORY_ID = process.env.DEFAULT_CATEGORY_ID || 'test~1489';
const DEFAULT_TAX_ID = process.env.DEFAULT_TAX_ID || 'test~0';
const DEFAULT_UNIT_ID = process.env.DEFAULT_UNIT_ID || 'test~1';

async function main() {
  const products = await exportFromShopify();
  const itemRoots = [];

  // Массовый импорт: перебираем все товары
  for (const p of products) {
    function stripQuery(url) {
      if (!url) return '';
      // Удаляем все параметры запроса после ? и #
      let cleanUrl = url.split(/[?#]/)[0];
      // Кодируем специальные символы в URL
      return encodeURI(cleanUrl);
    }

    const wooLikeVariations = p.variants.map(v => ({
      regular_price: v.price,
      sku: v.sku,
      stock_quantity: v.inventory_quantity,
      barcode: v.barcode,
      attributes: [
        ...(p.options || []).map((opt, idx) => ({
          option: v[`option${idx + 1}`] || ''
        }))
      ],
      image: {
        src: stripQuery((p.images.find(img => img.id === v.image_id) || {}).src) ||
             stripQuery(p.images[0] ? (p.images[0].src || p.images[0]) : '')
      },
      name: v.title || '',
      description: '',
      short_description: ''
    }));

    const itemRoot = await buildSlimrateItemRoot(
      {
        ...p,
        name: p.title,
        description: p.description,
        images: p.images.map(src => ({
          src: stripQuery(typeof src === 'string' ? src : src.src)
        })),
      },
      wooLikeVariations
    );
    itemRoot.categoryId = DEFAULT_CATEGORY_ID;
    itemRoot.taxId = DEFAULT_TAX_ID;
    itemRoot.quantityUnitId = DEFAULT_UNIT_ID;
    
    // Дополнительная проверка и очистка URL изображений
    if (itemRoot.image) {
      itemRoot.image = stripQuery(itemRoot.image);
    }
    if (itemRoot.items) {
      itemRoot.items = itemRoot.items.map(item => ({
        ...item,
        image: stripQuery(item.image),
        wooInfo: {
          ...item.wooInfo,
          pictures: (item.wooInfo.pictures || []).map(pic => stripQuery(pic))
        }
      }));
    }
    
    itemRoots.push(itemRoot);
  }

  const outPath = path.resolve('test-scripts/slimrate/import-from-shopify-preview.json');
  fs.writeFileSync(outPath, JSON.stringify(itemRoots, null, 2), 'utf-8');
  console.log(`✅ Сформировано item-root объектов: ${itemRoots.length}. Пример сохранён в ${outPath}`);

  for (const itemRoot of itemRoots) {
    try {
      console.log('==== BODY ДЛЯ ИМПОРТА ====');
      console.dir(itemRoot, { depth: null });
      const res = await axios.post(SLIMRATE_URL, itemRoot, { headers: { Authorization: SLIMRATE_TOKEN } });
      console.log('Импортирован:', itemRoot.displayName, res.status, res.data);
    } catch (e) {
      console.error('Ошибка импорта:', itemRoot.displayName, e.response?.status || '', e.response?.data || e.message);
    }
  }
}

main();
