import { useLocalStorage } from './useLocalStorage';

const MAX_ITEMS = 8;

export const useRecentlyViewed = () => {
  const [viewed, setViewed] = useLocalStorage('recently_viewed', []);

  const addProduct = (product) => {
    setViewed((prev) => {
      const filtered = prev.filter((p) => p._id !== product._id);
      const updated = [
        {
          _id: product._id,
          title: product.title,
          slug: product.slug,
          price: product.price,
          brand: product.brand,
          condition: product.condition,
          primaryImage:
            product.images?.find((i) => i.isPrimary)?.url ||
            product.images?.[0]?.url ||
            null,
          viewedAt: new Date().toISOString(),
        },
        ...filtered,
      ].slice(0, MAX_ITEMS);
      return updated;
    });
  };

  const clearViewed = () => setViewed([]);

  return { viewed, addProduct, clearViewed };
};