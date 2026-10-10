export type SalesOperationalOrder = {
  amount: number;
  platform_fee: number;
  creator_revenue: number;
  status: string;
  payment_mode: "test" | "live";
};

export type SalesOperationalReport = {
  paidOrderCount: number;
  refundedOrderCount: number;
  completedGrossSales: number;
  refundedAmount: number;
  netSales: number;
  netPlatformFees: number;
  netCreatorRevenue: number;
};

export function salesAdjustment(order: SalesOperationalOrder) {
  if (order.status === "paid") {
    return {
      sales: order.amount,
      refund: 0,
      platformFee: order.platform_fee,
      creatorRevenue: order.creator_revenue,
    };
  }
  if (order.status === "refunded") {
    return {
      sales: order.amount,
      refund: order.amount,
      platformFee: 0,
      creatorRevenue: 0,
    };
  }
  return { sales: 0, refund: 0, platformFee: 0, creatorRevenue: 0 };
}

export function buildSalesOperationalReport(
  orders: SalesOperationalOrder[],
  paymentMode: "test" | "live",
): SalesOperationalReport {
  return orders
    .filter((order) => order.payment_mode === paymentMode)
    .reduce<SalesOperationalReport>((report, order) => {
      const adjustment = salesAdjustment(order);
      return {
        paidOrderCount:
          report.paidOrderCount + (order.status === "paid" ? 1 : 0),
        refundedOrderCount:
          report.refundedOrderCount + (order.status === "refunded" ? 1 : 0),
        completedGrossSales: report.completedGrossSales + adjustment.sales,
        refundedAmount: report.refundedAmount + adjustment.refund,
        netSales:
          report.netSales + adjustment.sales - adjustment.refund,
        netPlatformFees:
          report.netPlatformFees + adjustment.platformFee,
        netCreatorRevenue:
          report.netCreatorRevenue + adjustment.creatorRevenue,
      };
    }, {
      paidOrderCount: 0,
      refundedOrderCount: 0,
      completedGrossSales: 0,
      refundedAmount: 0,
      netSales: 0,
      netPlatformFees: 0,
      netCreatorRevenue: 0,
    });
}
