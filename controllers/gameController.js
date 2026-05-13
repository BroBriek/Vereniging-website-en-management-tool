const { Game, User, sequelize } = require('../models');
const { Op, Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');

const SettingsService = require('../services/SettingsService');

exports.getGames = async (req, res) => {
    try {
        const limit = 10;
        const offset = parseInt(req.query.offset) || 0;
        const search = req.query.search || '';
        let groupFilter = req.query.group || '';
        const typeFilter = req.query.type || '';
        const intensityFilter = req.query.intensity || '';

        const whereClause = {};

        if (search) {
            whereClause[Op.or] = [
                { title: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } },
                Sequelize.where(
                    Sequelize.cast(Sequelize.col('tags'), 'TEXT'),
                    { [Op.like]: `%${search}%` }
                )
            ];
        }

        if (groupFilter) {
            // We use Sequelize.where with CAST to TEXT because Op.like on JSON columns
            // in SQLite/Sequelize incorrectly stringifies the search pattern with double quotes.
            // Using substring matching ensures we find the group even if the game has multiple groups.
            const groupQuery = Sequelize.where(
                Sequelize.cast(Sequelize.col('groups'), 'TEXT'),
                { [Op.like]: `%${groupFilter}%` }
            );

            // If we already have a search filter, we need to combine them
            if (whereClause[Op.or]) {
                const searchClause = { [Op.or]: [...whereClause[Op.or]] };
                delete whereClause[Op.or];
                whereClause[Op.and] = [searchClause, groupQuery];
            } else {
                whereClause[Op.and] = [groupQuery];
            }
        }

        if (typeFilter) {
            whereClause.type = typeFilter;
        }

        if (intensityFilter) {
            whereClause.intensity = intensityFilter;
        }

        const { count, rows: games } = await Game.findAndCountAll({
            where: whereClause,
            include: [{ model: User, as: 'author', attributes: ['id', 'username', 'profilePicture'] }],
            order: [['createdAt', 'DESC']],
            limit: limit,
            offset: offset,
            distinct: true
        });

        if (req.xhr || req.query.ajax) {
            return res.render('games/game_items', { games, user: req.user }, (err, html) => {
                if (err) {
                    console.error('Render Partial Error:', err);
                    return res.status(500).json({ error: 'Render Error' });
                }
                res.json({ html, hasMore: (offset + games.length) < count });
            });
        }

        res.render('games/index', {
            title: 'Spelendatabank',
            games,
            user: req.user,
            search,
            groupFilter,
            typeFilter,
            intensityFilter,
            hasMore: (offset + games.length) < count
        });
    } catch (error) {
        console.error('Get Games Error:', error);
        res.status(500).send('Server Error');
    }
};

exports.getAddGame = (req, res) => {
    res.render('games/add', { title: 'Nieuw Spel Toevoegen', user: req.user, game: null });
};

exports.postAddGame = async (req, res) => {
    try {
        const { title, description, howItWorks, supplies, duration, type, groups, intensity, tags, minPlayers, maxPlayers } = req.body;
        const attachments = req.files ? req.files.map(f => ({
            path: `/game_uploads/${f.filename}`,
            originalName: f.originalname,
            mimeType: f.mimetype
        })) : [];

        const groupArray = Array.isArray(groups) ? groups : (groups ? [groups] : []);
        const tagArray = Array.isArray(tags) ? tags : (tags ? [tags] : []);

        await Game.create({
            title,
            description,
            howItWorks,
            supplies,
            duration: parseInt(duration),
            type,
            groups: groupArray,
            intensity,
            tags: tagArray,
            minPlayers: minPlayers ? parseInt(minPlayers) : null,
            maxPlayers: maxPlayers ? parseInt(maxPlayers) : null,
            attachments,
            authorId: req.user.id
        });

        res.redirect('/games?success=Spel toegevoegd');
    } catch (error) {
        console.error('Add Game Error:', error);
        res.status(500).send('Kon spel niet toevoegen');
    }
};

exports.getGame = async (req, res) => {
    try {
        const game = await Game.findByPk(req.params.id, {
            include: [{ model: User, as: 'author', attributes: ['id', 'username', 'profilePicture'] }]
        });
        if (!game) return res.status(404).send('Spel niet gevonden');
        res.render('games/show', { title: game.title, game, user: req.user });
    } catch (error) {
        console.error('Get Game Error:', error);
        res.status(500).send('Server Error');
    }
};

exports.getEditGame = async (req, res) => {
    try {
        const game = await Game.findByPk(req.params.id);
        if (!game) return res.status(404).send('Spel niet gevonden');
        if (game.authorId !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).send('Geen toegang');
        }
        res.render('games/add', { title: 'Spel Bewerken', game, user: req.user });
    } catch (error) {
        console.error('Edit Game Error:', error);
        res.status(500).send('Server Error');
    }
};

exports.postEditGame = async (req, res) => {
    try {
        const game = await Game.findByPk(req.params.id);
        if (!game) return res.status(404).send('Spel niet gevonden');
        if (game.authorId !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).send('Geen toegang');
        }

        const { title, description, howItWorks, supplies, duration, type, groups, intensity, tags, minPlayers, maxPlayers, removed_attachments } = req.body;
        
        let currentAttachments = game.attachments || [];
        if (removed_attachments) {
            const toRemove = Array.isArray(removed_attachments) ? removed_attachments : [removed_attachments];
            currentAttachments = currentAttachments.filter(att => !toRemove.includes(att.path));
        }

        if (req.files && req.files.length > 0) {
            const newAttachments = req.files.map(f => ({
                path: `/game_uploads/${f.filename}`,
                originalName: f.originalname,
                mimeType: f.mimetype
            }));
            currentAttachments = [...currentAttachments, ...newAttachments];
        }

        const groupArray = Array.isArray(groups) ? groups : (groups ? [groups] : []);
        const tagArray = Array.isArray(tags) ? tags : (tags ? [tags] : []);

        await game.update({
            title,
            description,
            howItWorks,
            supplies,
            duration: parseInt(duration),
            type,
            groups: groupArray,
            intensity,
            tags: tagArray,
            minPlayers: minPlayers ? parseInt(minPlayers) : null,
            maxPlayers: maxPlayers ? parseInt(maxPlayers) : null,
            attachments: currentAttachments
        });

        res.redirect(`/games/${game.id}?success=Spel bijgewerkt`);
    } catch (error) {
        console.error('Update Game Error:', error);
        res.status(500).send('Kon spel niet bijwerken');
    }
};

exports.postDeleteGame = async (req, res) => {
    try {
        const game = await Game.findByPk(req.params.id);
        if (!game) return res.status(404).send('Spel niet gevonden');
        if (game.authorId !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).send('Geen toegang');
        }

        await game.destroy();
        res.redirect('/games?success=Spel verwijderd');
    } catch (error) {
        console.error('Delete Game Error:', error);
        res.status(500).send('Kon spel niet verwijderen');
    }
};

exports.searchGames = async (req, res) => {
    try {
        const query = req.query.q || '';
        // Removed length check to show results immediately or at least show the prompt correctly

        const games = await Game.findAll({
            where: {
                title: { [Op.like]: `%${query}%` }
            },
            attributes: ['id', 'title'],
            limit: 10
        });

        res.json(games);
    } catch (error) {
        console.error('Search Games Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
