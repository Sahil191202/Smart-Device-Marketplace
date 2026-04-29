import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Package,
  TrendingUp,
  ShoppingBag,
  Eye,
  Pencil,
  Trash2,
  MoreVertical,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  DollarSign,
  Tag,
  BarChart3,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { productsApi } from "../../api/products.api";
import { ordersApi } from "../../api/orders.api";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { PageWrapper } from "../../components/layout/PageWrapper";
import { formatPrice, formatDate, truncate } from "../../utils/format";

// ── Status config ─────────────────────────────────────────────────────────────
const PRODUCT_STATUS = {
  active: { label: "Active", variant: "success", icon: CheckCircle },
  sold: { label: "Sold", variant: "info", icon: CheckCircle },
  draft: { label: "Draft", variant: "warning", icon: Clock },
  removed: { label: "Removed", variant: "danger", icon: XCircle },
};

// ── Stat card ─────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, color, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 15 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="card p-5"
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
          {label}
        </p>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">
          {value}
        </p>
      </div>
      <div
        className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center`}
      >
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
  </motion.div>
);

// ── Product row ───────────────────────────────────────────────────────────────
const ProductRow = ({ product, onDelete, onStatusChange, deleting }) => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const cfg = PRODUCT_STATUS[product.status] || PRODUCT_STATUS.active;
  const primaryImage =
    product.images?.find((i) => i.isPrimary)?.url || product.images?.[0]?.url;

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0 }}
      className="flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group"
    >
      {/* Image */}
      <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden flex-shrink-0">
        {primaryImage ? (
          <img
            src={primaryImage}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-6 h-6 text-slate-300" />
          </div>
        )}
      </div>

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
          {product.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {product.brand}
          </span>
          <span className="text-slate-300 dark:text-slate-600">•</span>
          <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">
            {product.condition}
          </span>
          <span className="text-slate-300 dark:text-slate-600">•</span>
          <span className="text-xs text-slate-400 flex items-center gap-0.5">
            <Eye className="w-3 h-3" />
            {product.views || 0}
          </span>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
          Listed {formatDate(product.createdAt)}
        </p>
      </div>

      {/* Price */}
      <div className="text-right flex-shrink-0 hidden sm:block">
        <p className="text-sm font-bold text-slate-900 dark:text-white">
          {formatPrice(product.price)}
        </p>
        {product.predictedPrice?.value && (
          <p className="text-xs text-slate-400">
            AI: {formatPrice(product.predictedPrice.value)}
          </p>
        )}
      </div>

      {/* Status */}
      <div className="flex-shrink-0 hidden md:block">
        <Badge variant={cfg.variant} dot>
          {cfg.label}
        </Badge>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate(`/seller/edit/${product._id}`)}
          className="p-2 rounded-xl text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all opacity-0 group-hover:opacity-100"
          title="Edit"
        >
          <Pencil className="w-4 h-4" />
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => onDelete(product._id)}
          disabled={deleting}
          className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100"
          title="Remove"
        >
          {deleting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
        </motion.button>
      </div>
    </motion.div>
  );
};

// ── Main Seller Dashboard ─────────────────────────────────────────────────────
export default function SellerDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("listings");
  const [statusFilter, setStatusFilter] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  // Fetch my listings
  const { data: listingsData, isLoading: listingsLoading } = useQuery({
    queryKey: ["seller", "listings", statusFilter],
    queryFn: () =>
      productsApi.getMyListings({
        limit: 50,
        ...(statusFilter && { status: statusFilter }),
      }),
  });

  // Fetch seller orders
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["seller", "orders"],
    queryFn: () => ordersApi.getSellerOrders({ limit: 20 }),
    enabled: activeTab === "orders",
  });

  const listings = listingsData?.data?.data?.products || [];
  const orders = ordersData?.data?.data?.orders || [];

  // Stats derived from listings
  const stats = {
    total: listings.length,
    active: listings.filter((p) => p.status === "active").length,
    sold: listings.filter((p) => p.status === "sold").length,
    totalViews: listings.reduce((sum, p) => sum + (p.views || 0), 0),
  };

  // Delete listing
  const { mutate: deleteProduct } = useMutation({
    mutationFn: (id) => productsApi.delete(id),
    onMutate: (id) => setDeletingId(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller", "listings"] });
      toast.success("Listing removed");
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || "Failed to remove"),
    onSettled: () => setDeletingId(null),
  });

  const STATUS_FILTER_TABS = [
    { value: "", label: "All" },
    { value: "active", label: "Active" },
    { value: "sold", label: "Sold" },
    { value: "draft", label: "Draft" },
  ];

  return (
    <PageWrapper>
      <div className="container-page py-8 pb-20">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Seller Dashboard
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Manage your listings and track sales
            </p>
          </div>
          <Button
            icon={Plus}
            size="lg"
            onClick={() => navigate("/seller/create")}
            className="shadow-lg shadow-primary-600/20"
          >
            New Listing
          </Button>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={Tag}
            label="Total Listings"
            value={stats.total}
            color="bg-primary-600"
            delay={0}
          />
          <StatCard
            icon={CheckCircle}
            label="Active"
            value={stats.active}
            color="bg-green-500"
            delay={0.05}
          />
          <StatCard
            icon={ShoppingBag}
            label="Sold"
            value={stats.sold}
            color="bg-purple-500"
            delay={0.1}
          />
          <StatCard
            icon={Eye}
            label="Total Views"
            value={stats.totalViews.toLocaleString("en-IN")}
            color="bg-orange-500"
            delay={0.15}
          />
        </div>

        {/* Main tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 w-fit">
          {["listings", "orders"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                activeTab === tab
                  ? "bg-white dark:bg-dark-800 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              {tab}
              {tab === "listings" && stats.total > 0 && (
                <span className="ml-2 text-xs text-slate-400">
                  ({stats.total})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Listings tab ──────────────────────────────────────────────────── */}
        {activeTab === "listings" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="card p-4"
          >
            {/* Status filter */}
            <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-hide pb-1">
              {STATUS_FILTER_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border flex-shrink-0 ${
                    statusFilter === tab.value
                      ? "bg-primary-600 text-white border-primary-600"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {listingsLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="shimmer h-20 rounded-xl" />
                ))}
              </div>
            ) : listings.length === 0 ? (
              <div className="text-center py-16">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                  {statusFilter
                    ? `No ${statusFilter} listings`
                    : "No listings yet"}
                </p>
                <Button
                  icon={Plus}
                  onClick={() => navigate("/seller/create")}
                  size="sm"
                >
                  Create Your First Listing
                </Button>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {listings.map((product) => (
                    <ProductRow
                      key={product._id}
                      product={product}
                      onDelete={deleteProduct}
                      deleting={deletingId === product._id}
                    />
                  ))}
                </div>
              </AnimatePresence>
            )}
          </motion.div>
        )}

        {/* ── Orders tab ────────────────────────────────────────────────────── */}
        {activeTab === "orders" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="card p-4"
          >
            {ordersLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="shimmer h-20 rounded-xl" />
                ))}
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-16">
                <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  No orders yet. Once buyers purchase your items, orders will
                  appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => (
                  <SellerOrderRow key={order._id} order={order} />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </PageWrapper>
  );
}

// ── Seller order row ──────────────────────────────────────────────────────────
const SellerOrderRow = ({ order }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showShipForm, setShowShipForm] = useState(false);
  const [trackingData, setTrackingData] = useState({
    courier: "",
    trackingNumber: "",
  });

  const { mutate: markShipped, isPending: shipping } = useMutation({
    mutationFn: () => ordersApi.markShipped(order._id, trackingData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller", "orders"] });
      setShowShipForm(false);
      toast.success("Order marked as shipped!");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed"),
  });

  const { mutate: cancelOrder, isPending: cancelling } = useMutation({
    mutationFn: (reason) => ordersApi.cancel(order._id, reason),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["seller", "orders"] });
      const data = res.data.data;
      if (data.refundInitiated) {
        toast.success("Order cancelled. Refund initiated for buyer.");
      } else {
        toast.success("Order cancelled");
      }
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || "Failed to cancel"),
  });

  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const STATUS_COLORS = {
    pending: "text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30",
    confirmed: "text-blue-500 bg-blue-100 dark:bg-blue-900/30",
    shipped: "text-purple-500 bg-purple-100 dark:bg-purple-900/30",
    delivered: "text-green-500 bg-green-100 dark:bg-green-900/30",
    cancelled: "text-red-500 bg-red-100 dark:bg-red-900/30",
  };

  return (
    <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden flex-shrink-0">
          {order.productSnapshot?.primaryImageUrl ? (
            <img
              src={order.productSnapshot.primaryImageUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-5 h-5 text-slate-300" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
            {order.productSnapshot?.title}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Order #{order._id?.slice(-8).toUpperCase()} •{" "}
            {formatDate(order.createdAt)}
          </p>
        </div>

        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">
            {formatPrice(order.amount)}
          </p>
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[order.status] || ""}`}
          >
            {order.status}
          </span>
        </div>
      </div>

      {/* Buyer info */}
      {order.buyerId && (
        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
          <span>
            Buyer:{" "}
            {typeof order.buyerId === "object" ? order.buyerId.name : "N/A"}
          </span>
          {order.deliveryAddress && (
            <>
              <span>•</span>
              <span>
                {order.deliveryAddress.city}, {order.deliveryAddress.state}
              </span>
            </>
          )}
        </div>
      )}

      {/* Ship action */}
      {order.status === "confirmed" && (
        <>
          {!showShipForm ? (
            <Button
              size="sm"
              variant="outline"
              icon={Package}
              onClick={() => setShowShipForm(true)}
            >
              Mark as Shipped
            </Button>
          ) : (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="grid grid-cols-2 gap-2"
            >
              <input
                placeholder="Courier name (e.g. Delhivery)"
                value={trackingData.courier}
                onChange={(e) =>
                  setTrackingData((p) => ({ ...p, courier: e.target.value }))
                }
                className="input-base text-sm py-2 col-span-2"
              />
              <input
                placeholder="Tracking number"
                value={trackingData.trackingNumber}
                onChange={(e) =>
                  setTrackingData((p) => ({
                    ...p,
                    trackingNumber: e.target.value,
                  }))
                }
                className="input-base text-sm py-2"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  loading={shipping}
                  disabled={
                    !trackingData.courier || !trackingData.trackingNumber
                  }
                  onClick={() => markShipped()}
                  fullWidth
                >
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowShipForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          )}
        </>
      )}
      {["confirmed", "pending"].includes(order.status) && !showCancelForm && (
        <Button
          size="sm"
          variant="outline"
          className="!text-red-500 !border-red-200 hover:!bg-red-50"
          onClick={() => setShowCancelForm(true)}
        >
          Cancel Order
        </Button>
      )}

      {showCancelForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="space-y-2"
        >
          <textarea
            placeholder="Reason for cancellation (required)..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={2}
            className="input-base text-sm resize-none w-full"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="danger"
              loading={cancelling}
              disabled={!cancelReason.trim()}
              onClick={() => cancelOrder(cancelReason)}
              fullWidth
            >
              Confirm Cancel
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowCancelForm(false);
                setCancelReason("");
              }}
            >
              Back
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
};
