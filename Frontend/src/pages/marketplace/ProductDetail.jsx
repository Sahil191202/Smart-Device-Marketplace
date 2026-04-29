import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  ShoppingCart,
  MessageCircle,
  Share2,
  ChevronLeft,
  ChevronRight,
  Package,
  MapPin,
  Shield,
  Truck,
  RotateCcw,
  Star,
  ArrowLeft,
  Loader2,
  Eye,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { productsApi } from "../../api/products.api";
import { cartApi } from "../../api/cart.api";
import { wishlistApi } from "../../api/wishlist.api";
import { chatApi } from "../../api/chat.api";
import { DealScore } from "../../components/shared/DealScore";
import { ProductCard } from "../../components/shared/ProductCard";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { PageWrapper } from "../../components/layout/PageWrapper";
import { useAuthStore } from "../../store/auth.store";
import { useCartStore } from "../../store/cart.store";
import { formatPrice, formatDate, getConditionColor } from "../../utils/format";
import { Lightbox } from "../../components/ui/Lightbox";
import { ShareButton } from "../../components/shared/ShareButton";
import { RecentlyViewed } from "../../components/shared/RecentlyViewed";
import { useRecentlyViewed } from "../../hooks/useRecentlyViewed";

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated, user } = useAuthStore();
  const { increment: incrementCart } = useCartStore();

  const [activeImage, setActiveImage] = useState(0);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);

  // ── Fetch product ─────────────────────────────────────────────────────────
  const { data: productData, isLoading } = useQuery({
    queryKey: ["product", slug],
    queryFn: () => productsApi.getBySlug(slug),
  });

  const product = productData?.data?.data?.product;

  useEffect(() => {
    if (product) {
      setIsWishlisted(product.isWishlisted || false);
    }
  }, [product]);
  
  const { addProduct } = useRecentlyViewed();

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    if (product) addProduct(product);
  }, [product]);

  // ── Fetch AI price analysis ───────────────────────────────────────────────
  const { data: analysisData, isLoading: analysisLoading } = useQuery({
    queryKey: ["priceAnalysis", product?._id],
    queryFn: () => productsApi.getPriceAnalysis(product._id),
    enabled: !!product?._id,
    staleTime: 1000 * 60 * 30,
  });

  const analysis = analysisData?.data?.data;

  // ── Fetch related products ────────────────────────────────────────────────
  const { data: relatedData } = useQuery({
    queryKey: ["products", "related", product?.category],
    queryFn: () =>
      productsApi.list({
        category: product.category,
        limit: 4,
      }),
    enabled: !!product?.category,
    staleTime: 1000 * 60 * 10,
  });

  const related = (relatedData?.data?.data?.products || [])
    .filter((p) => p._id !== product?._id)
    .slice(0, 4);

  // ── Add to cart ───────────────────────────────────────────────────────────
  const { mutate: addToCart, isPending: cartPending } = useMutation({
    mutationFn: () => cartApi.add(product._id),
    onSuccess: () => {
      setAddedToCart(true);
      incrementCart();
      toast.success("Added to cart!");
      setTimeout(() => setAddedToCart(false), 3000);
    },
    onError: (err) => {
      const msg = err.response?.data?.message || "Failed to add to cart";
      toast.error(msg);
    },
  });

  // ── Wishlist ──────────────────────────────────────────────────────────────
  const { mutate: toggleWishlist } = useMutation({
    mutationFn: (currentlyWishlisted) =>
      currentlyWishlisted
        ? wishlistApi.remove(product._id)
        : wishlistApi.add(product._id),

    onSuccess: (_, currentlyWishlisted) => {
      setIsWishlisted(!currentlyWishlisted);

      queryClient.invalidateQueries({
        queryKey: ["wishlist"],
      });

      toast.success(
        !currentlyWishlisted ? "Saved to wishlist!" : "Removed from wishlist",
      );
    },

    onError: (_, currentlyWishlisted) => {
      setIsWishlisted(currentlyWishlisted);
      toast.error("Failed to update wishlist");
    },
  });

  // ── Start chat ────────────────────────────────────────────────────────────
  const { mutate: startChat, isPending: chatPending } = useMutation({
    mutationFn: () => chatApi.createRoom(product._id),
    onSuccess: (res) => {
      const roomId = res.data.data.room.roomId;
      navigate(`/chat/${roomId}`);
    },
    onError: () => toast.error("Failed to start chat"),
  });

  const handleAddToCart = () => {
    if (!isAuthenticated) {
      toast.error("Please login to add to cart");
      navigate("/login");
      return;
    }
    addToCart();
  };

  const handleWishlist = () => {
    if (!isAuthenticated) {
      toast.error("Please login to save items");
      navigate("/login");
      return;
    }
    toggleWishlist(isWishlisted);
  };

  const handleChat = () => {
    if (!isAuthenticated) {
      toast.error("Please login to chat with seller");
      navigate("/login");
      return;
    }
    startChat();
  };

  const isOwnProduct = user?.id === product?.sellerId?._id?.toString();

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <PageWrapper>
        <div className="container-page py-8">
          <div className="grid lg:grid-cols-2 gap-12">
            <div className="space-y-4">
              <div className="shimmer aspect-square rounded-2xl" />
              <div className="grid grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="shimmer aspect-square rounded-xl" />
                ))}
              </div>
            </div>
            <div className="space-y-5">
              <div className="shimmer h-8 w-3/4 rounded-xl" />
              <div className="shimmer h-6 w-1/2 rounded-xl" />
              <div className="shimmer h-12 w-1/3 rounded-xl" />
              <div className="shimmer h-24 w-full rounded-xl" />
              <div className="shimmer h-12 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </PageWrapper>
    );
  }

  if (!product) {
    return (
      <PageWrapper>
        <div className="container-page py-20 text-center">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
            Product not found
          </h2>
          <Button onClick={() => navigate("/marketplace")} icon={ArrowLeft}>
            Back to Marketplace
          </Button>
        </div>
      </PageWrapper>
    );
  }

  const images = product.images || [];
  const seller = typeof product.sellerId === "object" ? product.sellerId : null;

  return (
    <PageWrapper>
      <div className="container-page py-8 pb-20">
        {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* ── Left: Images ──────────────────────────────────────────────── */}
          <div className="space-y-4">
            {/* Main image */}
            <div
              onClick={() => {
                setLightboxIndex(activeImage);
                setLightboxOpen(true);
              }}
              className="relative overflow-hidden rounded-2xl bg-slate-50 dark:bg-slate-800/50 aspect-square"
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={activeImage}
                  src={images[activeImage]?.url}
                  alt={product.title}
                  className="w-full h-full object-cover"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
              </AnimatePresence>

              {/* Image navigation */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={() =>
                      setActiveImage((prev) =>
                        prev === 0 ? images.length - 1 : prev - 1,
                      )
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-white/90 dark:bg-dark-800/90 backdrop-blur-sm flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() =>
                      setActiveImage((prev) =>
                        prev === images.length - 1 ? 0 : prev + 1,
                      )
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-white/90 dark:bg-dark-800/90 backdrop-blur-sm flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}

              {/* Image counter */}
              {images.length > 1 && (
                <div className="absolute bottom-3 right-3 px-3 py-1.5 rounded-full bg-black/50 text-white text-xs font-medium backdrop-blur-sm">
                  {activeImage + 1} / {images.length}
                </div>
              )}
            </div>

            {/* Thumbnail strip */}
            {images.length > 1 && (
              <div className="grid grid-cols-5 gap-3">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                      activeImage === i
                        ? "border-primary-500 shadow-md"
                        : "border-transparent opacity-60 hover:opacity-80"
                    }`}
                  >
                    <img
                      src={img.url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Right: Product info ────────────────────────────────────────── */}
          <div className="space-y-6">
            {/* Status + badges */}
            <div className="flex items-center gap-3 flex-wrap">
              <Badge
                variant={
                  product.status === "active"
                    ? "success"
                    : product.status === "sold"
                      ? "danger"
                      : "default"
                }
                dot
              >
                {product.status === "active" ? "Available" : product.status}
              </Badge>
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${getConditionColor(product.condition)}`}
              >
                {product.condition}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 ml-auto">
                <Eye className="w-3.5 h-3.5 inline mr-1" />
                {product.views || 0} views
              </span>
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white leading-tight">
              {product.title}
            </h1>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
              <span>
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  Brand:
                </span>{" "}
                {product.brand}
              </span>
              {product.model && (
                <span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    Model:
                  </span>{" "}
                  {product.model}
                </span>
              )}
              {product.location?.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {product.location.city}, {product.location.state}
                </span>
              )}
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold text-slate-900 dark:text-white">
                {formatPrice(product.price)}
              </span>
              {product.predictedPrice?.value &&
                product.predictedPrice.value !== product.price && (
                  <span className="text-lg text-slate-400 line-through">
                    {formatPrice(product.predictedPrice.value)}
                  </span>
                )}
            </div>

            {/* AI Deal Score */}
            <DealScore analysis={analysis} loading={analysisLoading} />

            {/* Description */}
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
                Description
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            </div>

            {/* Specs */}
            {product.specs && Object.keys(product.specs).length > 0 && (
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-3">
                  Specifications
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(product.specs).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-sm"
                    >
                      <span className="text-slate-500 dark:text-slate-400 capitalize">
                        {key.replace(/_/g, " ")}
                      </span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        {String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Shield, label: "Secure Payment" },
                { icon: Truck, label: "Direct Shipping" },
                { icon: RotateCcw, label: "Return Policy" },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-center"
                >
                  <Icon className="w-5 h-5 text-primary-600" />
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            {product.status === "active" && !isOwnProduct && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    size="lg"
                    fullWidth
                    loading={cartPending}
                    disabled={addedToCart}
                    icon={addedToCart ? Star : ShoppingCart}
                    onClick={handleAddToCart}
                    className={addedToCart ? "!bg-green-500" : ""}
                  >
                    {addedToCart ? "Added!" : "Add to Cart"}
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    fullWidth
                    icon={Heart}
                    onClick={handleWishlist}
                    className={
                      isWishlisted ? "!border-red-300 !text-red-500" : ""
                    }
                  >
                    {isWishlisted ? "Saved" : "Wishlist"}
                  </Button>
                </div>

                <ShareButton
                  title={product.title}
                  price={formatPrice(product.price)}
                  url={window.location.href}
                />

                <Button
                  variant="secondary"
                  size="lg"
                  fullWidth
                  icon={MessageCircle}
                  loading={chatPending}
                  onClick={handleChat}
                >
                  Chat with Seller
                </Button>
              </div>
            )}

            {product.status === "sold" && (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 text-center">
                <p className="text-red-600 dark:text-red-400 font-semibold">
                  This item has been sold
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() =>
                    navigate("/marketplace?category=" + product.category)
                  }
                >
                  Find Similar
                </Button>
              </div>
            )}

            {isOwnProduct && (
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                onClick={() => navigate(`/seller`)}
              >
                Manage Your Listing
              </Button>
            )}

            {/* Seller card */}
            {seller && (
              <div className="card p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  {seller.avatar?.url ? (
                    <img
                      src={seller.avatar.url}
                      alt=""
                      className="w-full h-full rounded-xl object-cover"
                    />
                  ) : (
                    seller.name?.[0]?.toUpperCase()
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {seller.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Member since {formatDate(product.createdAt)}
                  </p>
                </div>
                {!isOwnProduct && (
                  <Button
                    size="sm"
                    variant="outline"
                    icon={MessageCircle}
                    onClick={handleChat}
                    loading={chatPending}
                  >
                    Chat
                  </Button>
                )}
              </div>
            )}

            {/* Listed date */}
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
              Listed on {formatDate(product.createdAt)}
            </p>
          </div>
        </div>

        {/* ── Related products ───────────────────────────────────────────── */}
        {related.length > 0 && (
          <div className="mt-16">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">
              Similar Listings
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
              {related.map((p, i) => (
                <ProductCard key={p._id} product={p} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>
      <Lightbox
        images={images}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />

      <RecentlyViewed />
    </PageWrapper>
  );
}
