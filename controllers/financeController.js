const { FinanceItem } = require('../models');
const ExcelJS = require('exceljs');

// Helper: Calculate total value of a folder recursively
const calculateFolderTotal = async (folderId) => {
    const children = await FinanceItem.findAll({ where: { parentId: folderId } });
    let total = 0;
    
    for (const child of children) {
        if (child.amount !== null) {
            // It's a transaction
            total += parseFloat(child.amount);
        } else {
            // It's a folder, recurse
            total += await calculateFolderTotal(child.id);
        }
    }
    return total;
};

// Helper: Get full path of a folder (for breadcrumbs)
const getBreadcrumbs = async (folderId) => {
    let crumbs = [];
    let currentId = folderId;
    
    while (currentId) {
        const folder = await FinanceItem.findByPk(currentId);
        if (!folder) break;
        crumbs.unshift({ id: folder.id, name: folder.name });
        currentId = folder.parentId;
    }
    return crumbs;
};

exports.getInfo = (req, res) => {
    res.render('admin/finance_info', {
        title: 'Financiën Info',
        user: req.user
    });
};

exports.getIndex = async (req, res) => {
    const parentId = req.params.folderId || null;
    
    // Get current folder info (if not root)
    let currentFolder = null;
    if (parentId) {
        currentFolder = await FinanceItem.findByPk(parentId);
        if (!currentFolder) return res.redirect('/admin/finance');
    }

    // Get children
    const items = await FinanceItem.findAll({ 
        where: { parentId },
        order: [['date', 'ASC'], ['createdAt', 'ASC']] 
    });

    // Calculate totals for folders in the current view
    const itemsWithTotals = await Promise.all(items.map(async (item) => {
        const data = item.toJSON();
        if (item.amount === null) {
            data.total = await calculateFolderTotal(item.id);
            data.childrenCount = await FinanceItem.count({ where: { parentId: item.id } });
        }
        return data;
    }));

    const breadcrumbs = await getBreadcrumbs(parentId);
    
    // Calculate total of CURRENT view/folder
    const currentTotal = parentId ? await calculateFolderTotal(parentId) : await calculateFolderTotal(null);

    res.render('admin/finance', { 
        title: 'Financieel Overzicht', 
        user: req.user,
        items: itemsWithTotals,
        currentFolder,
        breadcrumbs,
        currentTotal
    });
};

exports.postItem = async (req, res) => {
    const parentId = req.params.folderId || null;
    const { name, amount, date } = req.body;
    
    // If amount is empty string or undefined, treat as folder (null). 
    // If amount is '0', it's a transaction of 0.
    let finalAmount = null;
    if (amount !== '' && amount !== undefined) {
        finalAmount = parseFloat(amount);
    }

    await FinanceItem.create({
        name,
        amount: finalAmount,
        date: date || new Date(),
        parentId
    });

    res.redirect(parentId ? `/admin/finance/${parentId}` : '/admin/finance');
};

exports.updateItem = async (req, res) => {
    const { id } = req.params;
    const { name, amount, date } = req.body;
    
    const item = await FinanceItem.findByPk(id);
    
    if (item) {
        // If amount is empty string, keep it as is or handle based on logic?
        // Usually, editing implies we keep the type (folder vs transaction).
        // But user might want to change amount.
        
        let finalAmount = item.amount; // Default to old amount
        
        // Check if it was a folder (amount is null) or transaction
        // If we submit an empty amount string for a transaction, what happens?
        // Let's assume the edit form sends the value.
        
        if (amount !== undefined && amount !== '') {
            finalAmount = parseFloat(amount);
        } else if (amount === '') {
             // If explicitly cleared, maybe they want to turn it into a folder? 
             // Or maybe just keep it null if it was a folder.
             finalAmount = null;
        }

        await item.update({
            name,
            amount: finalAmount,
            date: date || item.date
        });
    }
    
    res.redirect(item && item.parentId ? `/admin/finance/${item.parentId}` : '/admin/finance');
};

exports.deleteItem = async (req, res) => {
    const item = await FinanceItem.findByPk(req.params.id);
    if (!item) {
        return res.redirect('/admin/finance');
    }

    const parentId = item.parentId;
    const returnUrl = parentId ? `/admin/finance/${parentId}` : '/admin/finance';

    // Check if it is a folder (amount is null) and has children
    if (item.amount === null) {
        const childrenCount = await FinanceItem.count({ where: { parentId: item.id } });
        if (childrenCount > 0) {
            return res.redirect(`${returnUrl}?error=Map is niet leeg. Verwijder eerst de inhoud.`);
        }
    }
    
    await item.destroy();
    res.redirect(returnUrl + '?success=Item verwijderd');
};

// Helper for Export: Flatten tree
const getFlatTransactions = async (folderId, currentPath = '') => {
    const items = await FinanceItem.findAll({ where: { parentId: folderId } });
    let transactions = [];

    for (const item of items) {
        if (item.amount !== null) {
            transactions.push({
                path: currentPath,
                name: item.name,
                amount: parseFloat(item.amount),
                date: item.date
            });
        } else {
            const subPath = currentPath ? `${currentPath} > ${item.name}` : item.name;
            const subTrans = await getFlatTransactions(item.id, subPath);
            transactions = transactions.concat(subTrans);
        }
    }
    return transactions;
};

exports.exportFolder = async (req, res) => {
    const folderId = req.params.folderId;
    const folder = await FinanceItem.findByPk(folderId);
    const folderName = folder ? folder.name : 'Hoofdmap';

    const transactions = await getFlatTransactions(folderId || null, folderName);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Financieel Overzicht');

    worksheet.columns = [
        { header: 'Pad', key: 'path', width: 40 },
        { header: 'Omschrijving', key: 'name', width: 30 },
        { header: 'Bedrag', key: 'amount', width: 15 },
        { header: 'Datum', key: 'date', width: 20 }
    ];

    let total = 0;
    transactions.forEach(t => {
        worksheet.addRow({
            path: t.path,
            name: t.name,
            amount: t.amount,
            date: t.date ? new Date(t.date).toLocaleDateString('nl-BE') : ''
        });
        total += t.amount;
    });

    // Add Total Row
    worksheet.addRow({});
    const totalRow = worksheet.addRow({
        path: 'TOTAAL',
        amount: total
    });
    totalRow.font = { bold: true };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=finance_${folderName}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
};