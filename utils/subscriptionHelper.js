// utils/subscriptionHelper.js
export const applySubscriptionDiscount = (user, price, pickupDelivery, quantity) => {
  let finalPrice = price + pickupDelivery;
  let paymentStatus = "Not Paid";
  let isFreeOrder = false;
  let paymentMethod = "COD"; // default

  if (
    user.subscription.status === "active" &&
    user.subscription.expiry &&
    new Date(user.subscription.expiry) > new Date()
  ) {
    const today = new Date().toISOString().split("T")[0];
    const usageDate = user.subscription.dailyUsage.date
      ? new Date(user.subscription.dailyUsage.date).toISOString().split("T")[0]
      : null;

    if (!usageDate || usageDate !== today) {
      user.subscription.dailyUsage.date = new Date();
      user.subscription.dailyUsage.count = 0;
    }

    if (quantity > 1) {
      throw new Error("Subscribed users can only order 1 quantity per service.");
    }

    if (user.subscription.dailyUsage.count < 2) {
      finalPrice = 0;
      isFreeOrder = true;
      paymentStatus = "Free (Subscribed)";
      paymentMethod = "SUBSCRIPTION";
      user.subscription.dailyUsage.count += 1;
    }
  }

  return { finalPrice, paymentStatus, isFreeOrder, paymentMethod };
};
