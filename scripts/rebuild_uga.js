const { sequelize } = require('../models');

const data = [                                                                            
  {                                                                          
    "id": 10,                                                                
    "role": "member",                                                        
    "userId": 7,                                                             
    "feedGroupId": 4,                                                        
    "createdAt": "2025-12-11 15:12:44.901 +00:00",                           
    "updatedAt": "2025-12-11 15:12:44.901 +00:00"                            
  },                                                                         
  {                                                                          
    "id": 11,                                                                
    "role": "member",                                                        
    "userId": 7,                                                             
    "feedGroupId": 5,                                                        
    "createdAt": "2025-12-11 15:12:44.901 +00:00",                           
    "updatedAt": "2025-12-11 15:12:44.901 +00:00"                            
  },                                                                         
  {                                                                          
    "id": 15,                                                                
    "role": "member",                                                        
    "userId": 9,                                                             
    "feedGroupId": 6,                                                        
    "createdAt": "2025-12-11 16:41:12.834 +00:00",                           
    "updatedAt": "2025-12-11 16:41:12.834 +00:00"                            
  },                                                                         
  {                                                                          
    "id": 16,                                                                
    "role": "member",                                                        
    "userId": 9,                                                             
    "feedGroupId": 4,                                                        
    "createdAt": "2025-12-11 16:41:12.834 +00:00",                           
    "updatedAt": "2025-12-11 16:41:12.834 +00:00"                            
  },                                                                         
  {                                                                          
    "id": 17,                                                                
    "role": "member",                                                        
    "userId": 9,                                                             
    "feedGroupId": 5,                                                        
    "createdAt": "2025-12-11 16:41:12.834 +00:00",                           
    "updatedAt": "2025-12-11 16:41:12.834 +00:00"                            
  },                                                                         
  {                                                                          
    "id": 18,                                                                
    "role": "member",                                                        
    "userId": 8,                                                             
    "feedGroupId": 6,                                                        
    "createdAt": "2025-12-14 14:52:24.395 +00:00",                           
    "updatedAt": "2025-12-14 14:52:24.395 +00:00"                            
  },                                                                         
  {                                                                          
    "id": 19,                                                                
    "role": "member",                                                        
    "userId": 8,                                                             
    "feedGroupId": 4,                                                        
    "createdAt": "2025-12-14 14:52:24.395 +00:00",                           
    "updatedAt": "2025-12-14 14:52:24.395 +00:00"                            
  },                                                                         
  {                                                                          
    "id": 20,                                                                
    "role": "member",                                                        
    "userId": 8,                                                             
    "feedGroupId": 5,                                                        
    "createdAt": "2025-12-14 14:52:24.395 +00:00",                           
    "updatedAt": "2025-12-14 14:52:24.395 +00:00"                            
  }                                                                          
];

async function rebuild() {
    try {
        console.log('Dropping UserGroupAccesses...');
        await sequelize.query("PRAGMA foreign_keys = OFF;");
        await sequelize.query("DROP TABLE IF EXISTS UserGroupAccesses;");
        await sequelize.query("DROP TABLE IF EXISTS UserGroupAccesses_backup;"); // Just in case
        
        console.log('Syncing...');
        // Only sync UserGroupAccess first to recreate it
        await sequelize.models.UserGroupAccess.sync({ force: true });
        
        console.log('Restoring data...');
        for (const item of data) {
            await sequelize.models.UserGroupAccess.create(item);
        }
        
        console.log('Restoration complete.');
        
    } catch (error) {
        console.error('Rebuild failed:', error);
    }
}

rebuild();
