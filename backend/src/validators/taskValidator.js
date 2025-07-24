const { body, param } = require('express-validator');

const validateUserTask = [
    body('title')
        .notEmpty()
        .withMessage('Title is required')
        .isLength({ max: 200 })
        .withMessage('Title must be less than 200 characters'),

    body('description')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Description must be less than 1000 characters'),

    body('assignedTo')
        .notEmpty()
        .withMessage('Assigned user is required')
        .isMongoId()
        .withMessage('Invalid user ID'),

    body('priority')
        .isIn(['low', 'medium', 'high', 'critical'])
        .withMessage('Priority must be low, medium, high, or critical'),

    body('dueDate')
        .notEmpty()
        .withMessage('Due date is required')
        .isISO8601()
        .withMessage('Invalid due date format'),

    body('progress')
        .optional()
        .isInt({ min: 0, max: 100 })
        .withMessage('Progress must be between 0 and 100')
];

const validateTaskId = [
    param('id')
        .isMongoId()
        .withMessage('Invalid task ID')
];

module.exports = {
    validateUserTask,
    validateTaskId
};