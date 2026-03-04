const { FinanceItem } = require('../models');

async function fixFinancePaidDefault() {
  try {
    console.log('Updating existing FinanceItems to set paid = true where it is null...');
    // In Sequelize with SQLite, null check might be needed for the new column
    // or just updating all where it's currently falsy if we just added it.
    const [updatedCount] = await FinanceItem.update(
      { paid: true },
      { 
        where: { 
          paid: null 
        } 
      }
    );
    console.log(`Successfully updated ${updatedCount} items.`);
    
    // Also check if any are false that should be true (just in case of sync issues)
    // but the null check is the primary one for newly added columns.
    
  } catch (error) {
    console.error('Error updating FinanceItems:', error);
  } finally {
    process.exit();
  }
}

fixFinancePaidDefault();
