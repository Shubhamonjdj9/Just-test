import { Router } from "express";
import { Category, Product, Review } from "../models/index.js";
import { parseProductQuery } from "../utils/commerce.js";
import { AppError, asyncHandler } from "../utils/errors.js";

const router = Router();

router.get(
  "/categories",
  asyncHandler(async (_request, response) => {
    const categories = await Category.find({ isActive: true }).sort({ name: 1 }).lean();
    response.json({ data: { categories } });
  }),
);

router.get(
  "/products",
  asyncHandler(async (request, response) => {
    let options;
    try {
      options = parseProductQuery(request.query);
    } catch (error) {
      throw new AppError(400, error.message);
    }
    const match = { isActive: true };
    if (options.featured) match.featured = true;
    if (options.search) {
      const escaped = options.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const categories = await Category.find({ isActive: true, name: { $regex: escaped, $options: "i" } }).select("_id").lean();
      const searchMatches = [{ $text: { $search: options.search } }];
      if (categories.length) searchMatches.push({ category: { $in: categories.map((category) => category._id) } });
      match.$and = [{ $or: searchMatches }];
    }
    if (options.brand) match.brand = options.brand;
    if (options.minRating !== undefined) match.averageRating = { $gte: options.minRating };
    if (options.inStock) match.stock = { $gt: 0 };

    const stages = [
      { $match: match },
      { $lookup: { from: "categories", localField: "category", foreignField: "_id", as: "_category" } },
      { $unwind: { path: "$_category", preserveNullAndEmptyArrays: true } },
    ];
    if (options.category) stages.push({ $match: { "_category.slug": options.category } });
    stages.push(
      {
        $addFields: {
          effectivePrice: {
            $round: [{ $multiply: ["$price", { $subtract: [1, { $divide: ["$discountPercent", 100] }] }] }, 0],
          },
        },
      },
    );
    if (options.minPrice !== undefined || options.maxPrice !== undefined) {
      const priceFilter = {};
      if (options.minPrice !== undefined) priceFilter.$gte = options.minPrice;
      if (options.maxPrice !== undefined) priceFilter.$lte = options.maxPrice;
      stages.push({ $match: { effectivePrice: priceFilter } });
    }
    const sortOptions = {
      newest: { createdAt: -1 },
      "price-asc": { effectivePrice: 1 },
      "price-desc": { effectivePrice: -1 },
      rating: { averageRating: -1, reviewCount: -1 },
      popular: { reviewCount: -1, createdAt: -1 },
    };
    stages.push(
      { $sort: { ...sortOptions[options.sort], _id: 1 } },
      {
        $facet: {
          products: [
            { $skip: (options.page - 1) * options.limit },
            { $limit: options.limit },
          ],
          metadata: [{ $count: "total" }],
        },
      },
    );

    const [result = { products: [], metadata: [] }] = await Product.aggregate(stages).option({ maxTimeMS: 2500 });
    const total = result.metadata[0]?.total ?? 0;
    response.json({
      data: {
        products: result.products.map(({ _category, ...product }) => ({ ...product, category: _category ?? null })),
        pagination: { page: options.page, limit: options.limit, total, pages: Math.ceil(total / options.limit) },
      },
    });
  }),
);

router.get(
  "/products/suggestions",
  asyncHandler(async (request, response) => {
    const q = typeof request.query.q === "string" ? request.query.q.trim().slice(0, 80) : "";
    if (q.length < 2) return response.json({ data: { products: [] } });
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const products = await Product.find({ isActive: true, name: { $regex: escaped, $options: "i" } })
      .select("name slug price discountPercent images")
      .limit(6)
      .maxTimeMS(1500)
      .lean();
    response.json({ data: { products } });
  }),
);

router.get(
  "/products/:slug",
  asyncHandler(async (request, response) => {
    const product = await Product.findOne({ slug: request.params.slug, isActive: true }).populate("category", "name slug").lean();
    if (!product) throw new AppError(404, "This product is no longer available.");
    const reviews = await Review.find({ product: product._id, isApproved: true })
      .populate("user", "name")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    const related = await Product.find({ category: product.category?._id, isActive: true, _id: { $ne: product._id } })
      .limit(4)
      .select("name slug price discountPercent images stock averageRating reviewCount")
      .lean();
    response.json({ data: { product, reviews, related } });
  }),
);

router.get(
  "/products/:slug/reviews",
  asyncHandler(async (request, response) => {
    const product = await Product.findOne({ slug: request.params.slug, isActive: true }).select("_id");
    if (!product) throw new AppError(404, "This product is no longer available.");
    const reviews = await Review.find({ product: product._id, isApproved: true })
      .populate("user", "name")
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();
    response.json({ data: { reviews } });
  }),
);

export default router;
