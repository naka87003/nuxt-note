import { getPrisma } from "../../utils/prisma";
import { getAuthenticatedUserId } from "../../utils/auth";
import { categoryName, categoryConflict } from "../../utils/categories";
export default defineEventHandler(async (event) => {
  const userId = await getAuthenticatedUserId(event);
  const data = categoryName(await readBody(event));
  try {
    const category = await getPrisma().category.create({
      data: { ...data, userId },
      select: { id: true, name: true },
    });
    setResponseStatus(event, 201);
    return category;
  } catch (error) {
    categoryConflict(error);
  }
});
