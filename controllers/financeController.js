const { FinanceItem } = require('../models');
const ExcelJS = require('exceljs');

// Helper: Calculate total value of a folder recursively
const calculateFolderTotal = async (folderId) => {
    const children = await FinanceItem.findAll({ where: { parentId: folderId } });
    let total = 0;
    
    for (const child of children) {
        if (child.amount !== null) {
            // It's a transaction
            if (child.paid) {
                total += parseFloat(child.amount);
            }
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

    // Get all unpaid items globally for the separate table
    const unpaidItems = await getFlatTransactions(null, 'Totaal', true);

    res.render('admin/finance', { 
        title: 'Financieel Overzicht', 
        user: req.user,
        items: itemsWithTotals,
        currentFolder,
        breadcrumbs,
        currentTotal,
        unpaidItems
    });
};

exports.postItem = async (req, res) => {
    const parentId = req.params.folderId || null;
    const { name, amount, date, paid } = req.body;
    
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
        parentId,
        paid: paid === 'on' || paid === true
    });

    res.redirect(parentId ? `/admin/finance/${parentId}` : '/admin/finance');
};

exports.updateItem = async (req, res) => {
    const { id } = req.params;
    const { name, amount, date, paid } = req.body;
    
    const item = await FinanceItem.findByPk(id);
    
    if (item) {
        let finalAmount = item.amount;
        if (amount !== undefined && amount !== '') {
            finalAmount = parseFloat(amount);
        } else if (amount === '') {
             finalAmount = null;
        }

        await item.update({
            name,
            amount: finalAmount,
            date: date || item.date,
            paid: paid === 'on' || paid === true
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
const getFlatTransactions = async (folderId, currentPath = '', onlyUnpaid = false) => {
    const where = { parentId: folderId };
    if (onlyUnpaid) {
        // If we want only unpaid, we can't easily filter by 'paid' here for folders
        // because we need to traverse folders to find unpaid items inside them.
    }
    
    const items = await FinanceItem.findAll({ where });
    let transactions = [];

    for (const item of items) {
        if (item.amount !== null) {
            if (!onlyUnpaid || !item.paid) {
                transactions.push({
                    id: item.id,
                    parentId: item.parentId,
                    path: currentPath,
                    name: item.name,
                    amount: parseFloat(item.amount),
                    date: item.date,
                    paid: item.paid
                });
            }
        } else {
            const subPath = currentPath ? `${currentPath} > ${item.name}` : item.name;
            const subTrans = await getFlatTransactions(item.id, subPath, onlyUnpaid);
            transactions = transactions.concat(subTrans);
        }
    }
    return transactions;
};

exports.exportFolder = async (req, res) => {
    const folderId = req.params.folderId === 'all' ? null : req.params.folderId;
    const folder = folderId ? await FinanceItem.findByPk(folderId) : null;
    const folderName = folder ? folder.name : 'Hoofdmap';

    const transactions = await getFlatTransactions(folderId || null, folderName);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Financieel Overzicht');

    worksheet.columns = [
        { header: 'Pad', key: 'path', width: 40 },
        { header: 'Omschrijving', key: 'name', width: 30 },
        { header: 'Bedrag', key: 'amount', width: 15 },
        { header: 'Datum', key: 'date', width: 20 },
        { header: 'Betaald', key: 'paid', width: 10 }
    ];

    let total = 0;
    transactions.forEach(t => {
        worksheet.addRow({
            path: t.path,
            name: t.name,
            amount: t.amount,
            date: t.date ? new Date(t.date).toLocaleDateString('nl-BE') : '',
            paid: t.paid ? 'Ja' : 'Nee'
        });
        if (t.paid) {
            total += t.amount;
        }
    });

    // Add Total Row
    worksheet.addRow({});
    const totalRow = worksheet.addRow({
        path: 'TOTAAL (BETAALD)',
        amount: total
    });
    totalRow.font = { bold: true };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=finance_${folderName}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
};

exports.exportUnpaid = async (req, res) => {
    const transactions = await getFlatTransactions(null, 'Totaal', true);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Niet Betaalde Items');

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
        path: 'TOTAAL NIET BETAALD',
        amount: total
    });
    totalRow.font = { bold: true };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=niet_betaalde_items.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
};