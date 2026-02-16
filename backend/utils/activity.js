const createActivity = async (pool, boardId, userId, actionType, entityType, entityId, metadata) => {
  try {
    let description = '';

    switch (actionType) {
      case 'created':
        description = `created ${entityType} "${metadata.title || entityId}"`;
        break;
      case 'updated':
        description = `updated ${entityType} "${metadata.title || entityId}"`;
        if (metadata.moved) {
          description += ' (moved)';
        }
        break;
      case 'deleted':
        description = `deleted ${entityType}`;
        break;
      case 'added_member':
        description = `added a member to the board`;
        break;
      case 'assigned':
        description = `assigned ${metadata.username || 'user'} to task`;
        break;
      case 'unassigned':
        description = `unassigned user from task`;
        break;
      default:
        description = `${actionType} ${entityType}`;
    }

    await pool.query(
      `INSERT INTO activities (board_id, user_id, action_type, entity_type, entity_id, description, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [boardId, userId, actionType, entityType, entityId, description, JSON.stringify(metadata)]
    );
  } catch (error) {
    console.error('Error creating activity:', error);
  }
};

module.exports = { createActivity };
