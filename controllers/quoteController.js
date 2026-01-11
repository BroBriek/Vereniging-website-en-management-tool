const { Quote, User, PageContent } = require('../models');

exports.getQuotes = async (req, res) => {
  try {
    const quotes = await Quote.findAll({
      include: [{ model: User, as: 'submitter', attributes: ['username'] }],
      order: [['createdAt', 'DESC']]
    });
    
    res.render('quotes/index', {
      title: 'Quoteboekje',
      quotes,
      user: req.user
    });
  } catch (error) {
    console.error('Error fetching quotes:', error);
    res.redirect('/feed?error=' + encodeURIComponent('Kon quotes niet ophalen.'));
  }
};

exports.createQuote = async (req, res) => {
  try {
    const { text, author } = req.body;
    
    if (!text || !author) {
      return res.redirect('/quotes?error=' + encodeURIComponent('Vul alle velden in.'));
    }
    
    await Quote.create({
      text,
      author,
      submittedBy: req.user ? req.user.id : null
    });
    
    res.redirect('/quotes?success=' + encodeURIComponent('Quote toegevoegd!'));
  } catch (error) {
    console.error('Error creating quote:', error);
    res.redirect('/quotes?error=' + encodeURIComponent('Kon quote niet toevoegen.'));
  }
};

exports.deleteQuote = async (req, res) => {
  try {
    const { id } = req.params;
    const quote = await Quote.findByPk(id);

    if (!quote) {
        return res.redirect('/quotes?error=' + encodeURIComponent('Quote niet gevonden.'));
    }

    // Check if admin or owner
    if (!req.user || (req.user.role !== 'admin' && req.user.id !== quote.submittedBy)) {
      return res.status(403).send('Niet geautoriseerd');
    }
    
    await quote.destroy();
    
    res.redirect('/quotes?success=' + encodeURIComponent('Quote verwijderd.'));
  } catch (error) {
    console.error('Error deleting quote:', error);
    res.redirect('/quotes?error=' + encodeURIComponent('Kon quote niet verwijderen.'));
  }
};

exports.deleteAllQuotes = async (req, res) => {
  try {
    // Check if admin
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).send('Niet geautoriseerd');
    }
    
    await Quote.destroy({ where: {}, truncate: false }); // truncate: true sometimes has issues with FKs in SQLite, false is safer (DELETE FROM table)
    
    res.redirect('/quotes?success=' + encodeURIComponent('Alle quotes verwijderd.'));
  } catch (error) {
      console.error('Error deleting all quotes:', error);
      res.redirect('/quotes?error=' + encodeURIComponent('Kon quotes niet resetten.'));
  }
};

// Helper to get Quote of the Month
exports.getQuoteOfTheMonth = async () => {
    try {
        const quotes = await Quote.findAll({
            order: [['createdAt', 'ASC']] // Sort by creation to have a stable order
        });
        
        if (quotes.length === 0) return null;
        
        const date = new Date();
        const currentMonthKey = `${date.getFullYear()}-${date.getMonth()}`; // e.g. "2026-0"

        // Get stored settings from PageContent
        // We use 'system_settings' as the slug to group these technical settings
        let indexSetting = await PageContent.findOne({ 
            where: { slug: 'system_settings', section_key: 'quote_index' } 
        });
        let monthSetting = await PageContent.findOne({ 
            where: { slug: 'system_settings', section_key: 'quote_last_month' } 
        });

        let index = indexSetting ? parseInt(indexSetting.content, 10) : 0;
        if (isNaN(index)) index = 0;
        
        let shouldSave = false;

        // Initialize or Update logic
        if (!monthSetting) {
            // First run ever: Initialize settings
            index = 0;
            shouldSave = true;
        } else if (monthSetting.content !== currentMonthKey) {
            // New month: Increment index
            index++;
            if (index >= quotes.length) {
                index = 0;
            }
            shouldSave = true;
        } else {
            // Same month: Check if index is still valid (e.g. if quotes were deleted)
            if (index >= quotes.length) {
                index = 0;
                shouldSave = true;
            }
        }

        if (shouldSave) {
            // Update or Create Index Setting
            if (indexSetting) {
                indexSetting.content = index.toString();
                await indexSetting.save();
            } else {
                await PageContent.create({
                    slug: 'system_settings',
                    section_key: 'quote_index',
                    content: index.toString(),
                    type: 'text'
                });
            }

            // Update or Create Month Setting
            if (monthSetting) {
                monthSetting.content = currentMonthKey;
                await monthSetting.save();
            } else {
                await PageContent.create({
                    slug: 'system_settings',
                    section_key: 'quote_last_month',
                    content: currentMonthKey,
                    type: 'text'
                });
            }
        }
        
        return quotes[index];
    } catch (error) {
        console.error("Error getting quote of month:", error);
        return null;
    }
};
