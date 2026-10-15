import mongoose from "mongoose";
import { config } from "./config/env.js";
import { connectDatabase } from "./config/database.js";
import { Category, Product } from "./models/index.js";

const categories = [
  { name: "The Living Edit", slug: "living", description: "Quiet details, considered for the rituals of home.", image: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=960&q=85" },
  { name: "Objects & Form", slug: "objects", description: "Functional pieces with a little more feeling.", image: "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=960&q=85" },
  { name: "Wear Well", slug: "wear", description: "Considered essentials for getting out the door.", image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=960&q=85" },
  { name: "Slow Sundays", slug: "self-care", description: "Little rituals for slowing down and looking after yourself.", image: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=960&q=85" },
];

const products = [
  { name: "Sunday Stoneware Set", slug: "sunday-stoneware-set", description: "An everyday set of two wheel-thrown ceramic cups. Finished in a soft, tactile glaze; each piece is a little different, just as it should be.", category: "objects", sku: "ATL-CER-001", price: 2400, stock: 28, featured: true, images: ["https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?auto=format&fit=crop&w=960&q=85"] },
  { name: "Soft Form Linen Throw", slug: "soft-form-linen-throw", description: "Relaxed European linen that only gets softer with time. Woven in small batches, with a generous drape for slow evenings.", category: "living", sku: "ATL-LIN-002", price: 6800, stock: 14, featured: true, images: ["https://images.unsplash.com/photo-1600210491369-e753d80a41f3?auto=format&fit=crop&w=960&q=85"] },
  { name: "Everyday Carryall", slug: "everyday-carryall", description: "A hard-wearing cotton canvas tote with a softly structured silhouette and room for the essentials you actually carry.", category: "wear", sku: "ATL-BAG-003", price: 1850, stock: 36, featured: true, images: ["https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=960&q=85"] },
  { name: "First Light Candle", slug: "first-light-candle", description: "A small-batch soy wax candle with notes of cedar, fig leaf and the quiet hour before the day begins. Approx. 45 hours of burn time.", category: "self-care", sku: "ATL-HME-004", price: 1450, stock: 42, featured: false, images: ["https://images.unsplash.com/photo-1602874801007-bd458bb1b8b6?auto=format&fit=crop&w=960&q=85"] },
  { name: "Good Morning Pour-Over", slug: "good-morning-pour-over", description: "A tactile, thoughtfully balanced ceramic dripper designed for an unhurried first cup. Fits standard cone filters.", category: "objects", sku: "ATL-CER-005", price: 2200, stock: 19, featured: true, images: ["https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=960&q=85"] },
  { name: "Weekend Market Shirt", slug: "weekend-market-shirt", description: "An easy, oversized cotton shirt for the long way home. Cut from breathable fabric and designed to wear on repeat.", category: "wear", sku: "ATL-WEA-006", price: 3850, stock: 22, featured: false, images: ["https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=960&q=85"], variants: [{ name: "Size", options: ["XS", "S", "M", "L", "XL"] }] },
  { name: "Little Ritual Hand Balm", slug: "little-ritual-hand-balm", description: "A rich but quick-absorbing, botanical hand balm made with shea butter and a gentle, fresh citrus scent.", category: "self-care", sku: "ATL-CARE-007", price: 850, stock: 55, featured: false, images: ["https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=960&q=85"] },
  { name: "Gather Together Serving Board", slug: "gather-together-serving-board", description: "Solid, responsibly sourced acacia with a softly rounded edge. A serving board and a lovely centrepiece, made to earn its place on the table.", category: "living", sku: "ATL-HME-008", price: 3200, stock: 2, featured: false, images: ["https://images.unsplash.com/photo-1495546968767-f0573cca821e?auto=format&fit=crop&w=960&q=85"] },
];

try {
  await connectDatabase(config.mongoUri);
  const categoryIds = new Map();
  for (const category of categories) {
    const record = await Category.findOneAndUpdate(
      { slug: category.slug },
      { $setOnInsert: category },
      { upsert: true, new: true },
    );
    categoryIds.set(category.slug, record._id);
  }

  for (const { category, ...product } of products) {
    await Product.updateOne(
      { slug: product.slug },
      { $setOnInsert: { ...product, category: categoryIds.get(category) } },
      { upsert: true },
    );
  }
  console.info(`Seeded ${categories.length} categories and ${products.length} starter products without replacing existing records or inventory.`);
} catch (error) {
  console.error("The store seed failed:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
