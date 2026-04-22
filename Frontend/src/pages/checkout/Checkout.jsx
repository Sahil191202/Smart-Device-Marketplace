import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Plus, Check, ChevronRight,
  Package, Shield, Loader2, ArrowLeft,
  CreditCard, AlertCircle,
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { ordersApi } from '../../api/orders.api';
import { cartApi } from '../../api/cart.api';
import { usersApi } from '../../api/users.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { useCartStore } from '../../store/cart.store';
import { formatPrice } from '../../utils/format';

// ── Address schema ────────────────────────────────────────────────────────────
const addressSchema = z.object({
  label: z.string().max(30).default('Home'),
  line1: z.string().min(5, 'Enter a valid address').max(100),
  line2: z.string().max(100).optional(),
  city: z.string().min(2, 'City required').max(50),
  state: z.string().min(2, 'State required').max(50),
  pincode: z.string().regex(/^\d{6}$/, 'Enter valid 6-digit pincode'),
  country: z.string().default('India'),
});

// ── Address card ──────────────────────────────────────────────────────────────
const AddressCard = ({ address, selected, onSelect }) => (
  <motion.button
    whileTap={{ scale: 0.99 }}
    onClick={() => onSelect(address._id)}
    className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
      selected
        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
    }`}
  >
    <div className="flex items-start justify-between">
      <div className="flex items-start gap-3">
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
          selected
            ? 'border-primary-500 bg-primary-500'
            : 'border-slate-300 dark:border-slate-600'
        }`}>
          {selected && <Check className="w-3 h-3 text-white" />}
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              {address.label}
            </span>
            {address.isDefault && (
              <span className="px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-xs font-medium">
                Default
              </span>
            )}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {address.line1}
            {address.line2 ? `, ${address.line2}` : ''}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {address.city}, {address.state} — {address.pincode}
          </p>
        </div>
      </div>
      <MapPin className={`w-4 h-4 flex-shrink-0 mt-1 ${
        selected ? 'text-primary-500' : 'text-slate-300 dark:text-slate-600'
      }`} />
    </div>
  </motion.button>
);

// ── Add address form ──────────────────────────────────────────────────────────
const AddAddressForm = ({ onSave, onCancel, saving }) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(addressSchema),
    defaultValues: { label: 'Home', country: 'India' },
  });

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="card p-5 space-y-4"
    >
      <h4 className="font-semibold text-slate-900 dark:text-white">
        New Delivery Address
      </h4>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Label"
          placeholder="Home / Work"
          error={errors.label?.message}
          {...register('label')}
        />
        <Input
          label="Pincode"
          placeholder="400001"
          error={errors.pincode?.message}
          {...register('pincode')}
        />
      </div>

      <Input
        label="Address Line 1"
        placeholder="Flat no, Building, Street"
        error={errors.line1?.message}
        required
        {...register('line1')}
      />

      <Input
        label="Address Line 2 (optional)"
        placeholder="Area, Landmark"
        {...register('line2')}
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="City"
          placeholder="Mumbai"
          error={errors.city?.message}
          required
          {...register('city')}
        />
        <Input
          label="State"
          placeholder="Maharashtra"
          error={errors.state?.message}
          required
          {...register('state')}
        />
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          fullWidth
          onClick={onCancel}
          type="button"
        >
          Cancel
        </Button>
        <Button
          fullWidth
          loading={saving}
          onClick={handleSubmit(onSave)}
          type="button"
        >
          Save Address
        </Button>
      </div>
    </motion.div>
  );
};

// ── Step indicator ────────────────────────────────────────────────────────────
const StepIndicator = ({ currentStep }) => {
  const steps = ['Address', 'Review', 'Payment'];

  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {steps.map((step, i) => {
        const stepNum = i + 1;
        const isDone = stepNum < currentStep;
        const isActive = stepNum === currentStep;

        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-300 ${
                isDone
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
                  : isActive
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
              }`}>
                {isDone ? <Check className="w-4 h-4" /> : stepNum}
              </div>
              <span className={`text-xs mt-1.5 font-medium ${
                isActive || isDone
                  ? 'text-primary-600'
                  : 'text-slate-400'
              }`}>
                {step}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-20 h-0.5 mx-1 mb-5 transition-all duration-500 ${
                isDone ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-700'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Razorpay loader ───────────────────────────────────────────────────────────
const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

// ── Main Checkout page ────────────────────────────────────────────────────────
export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { reset: resetCart } = useCartStore();

  const productId = location.state?.productId;

  const [step, setStep] = useState(1);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Redirect if no productId
  useEffect(() => {
    if (!productId) navigate('/cart');
  }, [productId, navigate]);

  // ── Fetch addresses ───────────────────────────────────────────────────────
  const { data: addrData, isLoading: addrLoading, refetch: refetchAddresses } = useQuery({
    queryKey: ['addresses'],
    queryFn: usersApi.getAddresses,
  });

  const addresses = addrData?.data?.data?.addresses || [];

  // Auto-select default address
  useEffect(() => {
    if (addresses.length > 0 && !selectedAddressId) {
      const def = addresses.find((a) => a.isDefault) || addresses[0];
      setSelectedAddressId(def._id);
    }
  }, [addresses, selectedAddressId]);

  // ── Fetch cart for order summary ──────────────────────────────────────────
  const { data: cartData } = useQuery({
    queryKey: ['cart'],
    queryFn: cartApi.get,
  });

  const cart = cartData?.data?.data?.cart;
  const cartItem = cart?.items?.find((i) => i.productId === productId);

  // ── Add address ───────────────────────────────────────────────────────────
  const { mutate: addAddress, isPending: addingAddress } = useMutation({
    mutationFn: usersApi.addAddress,
    onSuccess: async (res) => {
      await refetchAddresses();
      const newAddr = res.data.data.addresses;
      const latest = newAddr[newAddr.length - 1];
      setSelectedAddressId(latest._id);
      setShowAddForm(false);
      toast.success('Address saved!');
    },
    onError: () => toast.error('Failed to save address'),
  });

  // ── Initiate checkout ─────────────────────────────────────────────────────
  const { mutate: initiateCheckout, isPending: checkoutPending } = useMutation({
    mutationFn: (data) => ordersApi.checkout(data),
    onSuccess: async (res) => {
      const data = res.data.data;
      await handleRazorpayPayment(data);
    },
    onError: (err) => {
      const msg = err.response?.data?.message || 'Checkout failed';
      toast.error(msg);
    },
  });

  // ── Verify payment ────────────────────────────────────────────────────────
  const { mutate: verifyPayment } = useMutation({
    mutationFn: ordersApi.verifyPayment,
    onSuccess: (res) => {
      const order = res.data.data.order;
      setPaymentLoading(false);
      resetCart();
      navigate('/checkout/success', {
        state: { order },
        replace: true,
      });
    },
    onError: () => {
      setPaymentLoading(false);
      toast.error('Payment verification failed. Contact support.');
    },
  });

  // ── Open Razorpay modal ───────────────────────────────────────────────────
  const handleRazorpayPayment = async (checkoutData) => {
    const loaded = await loadRazorpay();
    if (!loaded) {
      toast.error('Failed to load payment gateway. Please refresh.');
      return;
    }

    setPaymentLoading(true);

    const options = {
      key: checkoutData.razorpayKeyId ||
        import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount: checkoutData.amountInPaise,
      currency: 'INR',
      name: 'SmartMarketplace',
      description: cartItem?.title || 'Device Purchase',
      order_id: checkoutData.razorpayOrderId,

      // Success handler
      handler: (response) => {
        verifyPayment({
          orderId: checkoutData.orderId,
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        });
      },

      // Prefill buyer info
      prefill: {
        name: '',
        email: '',
      },

      theme: {
        color: '#2563eb',
      },

      modal: {
        ondismiss: () => {
          setPaymentLoading(false);
          toast('Payment cancelled', { icon: 'ℹ️' });
        },
      },
    };

    const rzp = new window.Razorpay(options);

    rzp.on('payment.failed', (response) => {
      setPaymentLoading(false);
      toast.error(`Payment failed: ${response.error.description}`);
    });

    rzp.open();
  };

  const handlePlaceOrder = () => {
    if (!selectedAddressId) {
      toast.error('Please select a delivery address');
      return;
    }

    initiateCheckout({
      productId,
      addressId: selectedAddressId,
    });
  };

  const selectedAddress = addresses.find((a) => a._id === selectedAddressId);

  // ── Payment loading overlay ───────────────────────────────────────────────
  if (paymentLoading) {
    return (
      <PageWrapper>
        <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="w-20 h-20 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-6">
              <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Processing Payment
            </h2>
            <p className="text-slate-500 dark:text-slate-400">
              Please complete the payment in the Razorpay window
            </p>
          </motion.div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="container-page py-12 pb-20">

        {/* Back button */}
        <button
          onClick={() => navigate('/cart')}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Cart
        </button>

        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-8 text-center">
          Checkout
        </h1>

        {/* Step indicator */}
        <StepIndicator currentStep={step} />

        <div className="grid lg:grid-cols-3 gap-8 max-w-5xl mx-auto">

          {/* ── Left: Steps ──────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Step 1: Address */}
            <div className={`space-y-4 ${step < 1 ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary-600" />
                  Delivery Address
                </h2>
                {step > 1 && (
                  <button
                    onClick={() => setStep(1)}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Change
                  </button>
                )}
              </div>

              {step === 1 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-3"
                >
                  {addrLoading ? (
                    <div className="space-y-3">
                      {[...Array(2)].map((_, i) => (
                        <div key={i} className="shimmer h-24 rounded-xl" />
                      ))}
                    </div>
                  ) : (
                    <>
                      {addresses.map((addr) => (
                        <AddressCard
                          key={addr._id}
                          address={addr}
                          selected={selectedAddressId === addr._id}
                          onSelect={setSelectedAddressId}
                        />
                      ))}

                      <AnimatePresence>
                        {showAddForm && (
                          <AddAddressForm
                            onSave={addAddress}
                            onCancel={() => setShowAddForm(false)}
                            saving={addingAddress}
                          />
                        )}
                      </AnimatePresence>

                      {!showAddForm && (
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setShowAddForm(true)}
                          className="w-full p-4 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-primary-300 hover:text-primary-600 transition-all flex items-center justify-center gap-2 text-sm font-medium"
                        >
                          <Plus className="w-4 h-4" />
                          Add New Address
                        </motion.button>
                      )}
                    </>
                  )}

                  {addresses.length > 0 && selectedAddressId && (
                    <Button
                      fullWidth
                      size="lg"
                      icon={ChevronRight}
                      iconPosition="right"
                      onClick={() => setStep(2)}
                    >
                      Continue to Review
                    </Button>
                  )}
                </motion.div>
              )}

              {/* Collapsed view for completed step */}
              {step > 1 && selectedAddress && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-sm text-slate-600 dark:text-slate-400">
                  <p className="font-medium text-slate-900 dark:text-white mb-0.5">
                    {selectedAddress.label}
                  </p>
                  <p>{selectedAddress.line1}{selectedAddress.line2 ? `, ${selectedAddress.line2}` : ''}</p>
                  <p>{selectedAddress.city}, {selectedAddress.state} — {selectedAddress.pincode}</p>
                </div>
              )}
            </div>

            {/* Step 2: Review */}
            {step >= 2 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Package className="w-5 h-5 text-primary-600" />
                    Review Order
                  </h2>
                </div>

                {cartItem && (
                  <div className="card p-4 flex gap-4">
                    <div className="w-20 h-20 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden flex-shrink-0">
                      {cartItem.primaryImageUrl ? (
                        <img
                          src={cartItem.primaryImageUrl}
                          alt={cartItem.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-8 h-8 text-slate-300" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-2">
                        {cartItem.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 capitalize">
                        {cartItem.condition?.replace('-', ' ')} • {cartItem.category}
                      </p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white mt-2">
                        {formatPrice(cartItem.currentPrice)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Security note */}
                <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30">
                  <Shield className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-300">
                      Secure & Protected
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                      Your payment is secured by Razorpay. We never store card details.
                    </p>
                  </div>
                </div>

                <Button
                  fullWidth
                  size="lg"
                  loading={checkoutPending}
                  icon={CreditCard}
                  iconPosition="right"
                  onClick={handlePlaceOrder}
                  className="shadow-lg shadow-primary-600/20"
                >
                  Pay {cartItem ? formatPrice(cartItem.currentPrice) : ''}
                </Button>
              </motion.div>
            )}
          </div>

          {/* ── Right: Order summary ──────────────────────────────────────── */}
          <div>
            <div className="card p-5 sticky top-24 space-y-4">
              <h3 className="font-bold text-slate-900 dark:text-white">
                Order Summary
              </h3>

              {cartItem ? (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400 line-clamp-1 flex-1 mr-2">
                      {cartItem.title}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white flex-shrink-0">
                      {formatPrice(cartItem.currentPrice)}
                    </span>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-700/50 pt-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">Subtotal</span>
                      <span className="font-medium">{formatPrice(cartItem.currentPrice)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">Platform fee</span>
                      <span className="font-medium text-green-600">Free</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">GST</span>
                      <span className="font-medium text-green-600">Included</span>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-700/50 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white">Total</span>
                      <span className="text-xl font-bold text-primary-600">
                        {formatPrice(cartItem.currentPrice)}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="shimmer h-20 rounded-xl" />
              )}

              <div className="pt-2 space-y-2 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  100% secure payments
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  Buyer protection guaranteed
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}