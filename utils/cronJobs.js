import cron from 'node-cron';
import Wallet from '../models/DelieveryWallet.js';
import VendorWallet from '../models/VendorWallet.js'; 

// Reset daily earnings at midnight (00:00) every day
export const startDailyEarningsReset = () => {
  // Run at 00:00 (midnight) every day
  cron.schedule('0 0 * * *', async () => {
    try {
      console.log('Running daily earnings reset job...');
      
      // Reset delivery boy wallets
      const deliveryWallets = await Wallet.find({ todaysEarnings: { $gt: 0 } });
      
      for (const wallet of deliveryWallets) {
        wallet.withdrawableBalance += wallet.todaysEarnings;
        wallet.todaysEarnings = 0;
        wallet.lastEarningDate = new Date();
        await wallet.save();
      }
      
      // Reset vendor wallets - ADD THIS SECTION
      const vendorWallets = await VendorWallet.find({ todaysEarnings: { $gt: 0 } });
      
      for (const wallet of vendorWallets) {
        wallet.withdrawableBalance += wallet.todaysEarnings;
        wallet.todaysEarnings = 0;
        wallet.lastEarningDate = new Date();
        await wallet.save();
      }
      
      console.log(`Daily earnings reset completed for ${deliveryWallets.length} delivery boy wallets and ${vendorWallets.length} vendor wallets`);
    } catch (error) {
      console.error('Error in daily earnings reset:', error);
    }
  }, {
    timezone: "Asia/Kolkata"
  });
  
  console.log('Daily earnings reset cron job started for delivery boys and vendors');
};

// Updated manual reset function
export const manualEarningsReset = async () => {
  try {
    console.log('Running manual earnings reset...');
    
    let deliveryWalletsUpdated = 0;
    let vendorWalletsUpdated = 0;
    
    // Reset delivery boy wallets
    const deliveryWallets = await Wallet.find({});
    for (const wallet of deliveryWallets) {
      const today = new Date();
      const lastEarningDate = new Date(wallet.lastEarningDate);
      
      if (today.toDateString() !== lastEarningDate.toDateString()) {
        wallet.withdrawableBalance += wallet.todaysEarnings;
        wallet.todaysEarnings = 0;
        wallet.lastEarningDate = today;
        await wallet.save();
        deliveryWalletsUpdated++;
      }
    }
    
    // Reset vendor wallets - ADD THIS SECTION
    const vendorWallets = await VendorWallet.find({});
    for (const wallet of vendorWallets) {
      const today = new Date();
      const lastEarningDate = new Date(wallet.lastEarningDate);
      
      if (today.toDateString() !== lastEarningDate.toDateString()) {
        wallet.withdrawableBalance += wallet.todaysEarnings;
        wallet.todaysEarnings = 0;
        wallet.lastEarningDate = today;
        await wallet.save();
        vendorWalletsUpdated++;
      }
    }
    
    console.log(`Manual earnings reset completed for ${deliveryWalletsUpdated} delivery boy wallets and ${vendorWalletsUpdated} vendor wallets`);
    
    return { 
      success: true, 
      deliveryWalletsUpdated, 
      vendorWalletsUpdated,
      totalWalletsUpdated: deliveryWalletsUpdated + vendorWalletsUpdated
    };
  } catch (error) {
    console.error('Error in manual earnings reset:', error);
    return { success: false, error: error.message };
  }
};