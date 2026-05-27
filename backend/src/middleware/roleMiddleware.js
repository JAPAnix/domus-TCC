import prisma from '../config/database.js';

const roleMiddleware = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id; // vem do authMiddleware

      const userWithRoles = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          user_roles: {
            select: {
              role: {
                select: { name: true }
              }
            }
          }
        }
      });

      if (!userWithRoles) {
        return res.status(401).json({ message: 'Usuário não encontrado' });
      }

      const userRoles = userWithRoles.user_roles.map(ur => ur.role.name);

      const hasRole = allowedRoles.some(role => userRoles.includes(role));
      if (!hasRole) {
        return res.status(403).json({ message: 'Acesso negado' });
      }

      req.roles = userRoles; // opcional, útil em controllers
      next();
    } catch (err) {
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  };
};

export default roleMiddleware;