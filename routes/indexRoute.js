import { Router } from "express";
import multer from "multer";
import prisma from "../prisma.js";
import { body, validationResult } from "express-validator";
import CustomNotFoundError from "../errors/customError.js";
import supabase from "../config/supabase.js";
const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
})
const indexRouter = Router();

indexRouter.get("/", (req, res) => {
    res.redirect("/home")
})

const fileFormatter = (files) => {
    return files.map(file => {
        // Format date
        const dateModified = file.dateModified
            ? new Date(file.dateModified).toLocaleDateString("en-US", {
                month: "short",
                day: "2-digit",
                year: "numeric",
            })
            : null;

        // Format size
        let sizeFormatted = "0 B";
        if (file.size) {
            const bytes = file.size;
            if (bytes < 1024) {
                sizeFormatted = bytes + " B";
            } else if (bytes < 1024 ** 2) {
                sizeFormatted = (bytes / 1024).toFixed(2) + " KB";
            } else if (bytes < 1024 ** 3) {
                sizeFormatted = (bytes / 1024 ** 2).toFixed(2) + " MB";
            } else {
                sizeFormatted = (bytes / 1024 ** 3).toFixed(2) + " GB";
            }
        }

        return {
            ...file,
            dateModified,
            sizeFormatted,
        };
    });
}

const folderFormatter = (folders) => {
    return folders.map(folder => {
        // Format date
        const dateModified = folder.dateModified
            ? new Date(folder.dateModified).toLocaleDateString("en-US", {
                month: "short",
                day: "2-digit",
                year: "numeric",
            })
            : null;

        return {
            ...folder,
            dateModified,
        };
    });
}

indexRouter.get("/home", async (req, res, next) => {
    const { id } = req.user;
    try {
        const folder = await prisma.folder.findFirst({
            where: {
                userId: id,
                name: "home",
                parentId: null,
            },
            select: {
                id: true,
                name: true,
                parentId: true,
                dateModified: true,
                files: true,
                children: {
                    select: {
                        id: true,
                        name: true,
                        dateModified: true
                    }
                },
            },
        });

        if (!folder) {
            throw new CustomNotFoundError("Home Folder Not Found")
        }
        const formattedFolders = folderFormatter(folder.children);

        const formattedFiles = fileFormatter(folder.files);
        res.render("index", {
            folderId: folder.id,
            files: formattedFiles,
            folders: formattedFolders,
            parentFolder: { id: folder.parentId ? folder.parentId : null }
        });
    }
    catch (err) {
        return next(err)
    }
})

indexRouter.get("/:folder", async (req, res, next) => {
    const { folder } = req.params;
    const { id } = req.user;
    try {
        const folderData = await prisma.folder.findFirst({
            where: {
                id: parseInt(folder),
                userId: id,
            },
            select: {
                id: true,
                name: true,
                parentId: true,
                dateModified: true,
                files: true,
                children: {
                    select: {
                        id: true,
                        name: true,
                        dateModified: true,
                    },
                },
            },
        });

        if (!folderData) {
            throw new CustomNotFoundError("Folder Not Found")
        }
        const formattedFolders = folderFormatter(folderData.children);

        const formattedFiles = fileFormatter(folderData.files);

        res.render("index", {
            folderId: folderData.id,
            files: formattedFiles,
            folders: formattedFolders,
            parentFolder: { id: folderData.parentId ? folderData.parentId : null }
        });
    }
    catch (err) {
        return next(err)
    }
})

indexRouter.post("/:folder/fileInput", upload.single('file'), async (req, res, next) => {
    if (!req.file) {
        throw new Error("No File Uploaded")
    }
    const { folder } = req.params;
    try {
        const check = prisma.folder.findUnique({
            where: {
                id: parseInt(folder),
                userId: req.user.id
            }
        })
        if (!check) {
            throw new CustomNotFoundError("Folder Not Found")
        }
    }
    catch (err) {
        return next(err)
    }
    try {
        const filePath = `/${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9-_\.]/g, "_")}`;
        const { data, error } = await supabase.storage
            .from('fileuploader')
            .upload(filePath, req.file.buffer, {
                contentType: req.file.mimetype,
            });
        if (error) {
            throw error;
        }
        const folderId = parseInt(folder);
        await prisma.file.create({
            data: {
                name: req.file.originalname,
                url: data.path,
                folderId: folderId,
                size: req.file.size,
                userId: req.user.id
            }
        })
    }
    catch (err) {
        return next(err)
    }
    res.redirect(`/${folder}`);
})

indexRouter.get("/file/:fileId", async (req, res, next) => {
    const { fileId } = req.params;
    const { id: userId } = req.user;
    try {
        const file = await prisma.file.findUnique({
            where: { id: parseInt(fileId) }
        });
        if (!file || file.userId !== userId) {
            throw new CustomNotFoundError("File Not Found");
        }
        const { data, error } = await supabase.storage
            .from('fileuploader')
            .download(file.url);
        if (error || !data) throw error || new Error("Failed to download file");

        const buffer = Buffer.from(await data.arrayBuffer());

        res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', buffer.length);
        res.end(buffer);
    }
    catch (err) {
        return next(err)
    }
})

indexRouter.get("/delete/file/:fileId", async (req, res, next) => {
    const { fileId } = req.params;
    const { id: userId } = req.user;
    try {
        const file = await prisma.file.findFirst({
            where: {
                id: parseInt(fileId)
            },
            include: {
                folder: true
            }
        });
        if (!file || file.userId !== userId) {
            throw new CustomNotFoundError("File Not Found");
        }
        await supabase.storage
            .from('fileuploader')
            .remove([file.url]);
        await prisma.file.delete({
            where: {
                id: parseInt(fileId)
            }
        })

        res.redirect(`/${file.folder.id}`);
    }
    catch (err) {
        return next(err)
    }
})

indexRouter.get("/create-folder/:parentId", async (req, res, next) => {
    const { parentId } = req.params;
    const { id: userId } = req.user;
    try {
        const parentFolder = await prisma.folder.findFirst({
            where: {
                id: parseInt(parentId),
                userId: userId
            }
        })
        if (!parentFolder) {
            throw new CustomNotFoundError("Parent Folder Not Found")
        }
    }
    catch (err) {
        return next(err)
    }
    res.render("createFolderForm", {
        parentFolderId: parentId
    });
});

indexRouter.post("/create-folder/:parentId", [
    body("name").escape().trim().isLength({ min: 1 }).withMessage("Folder name is required")
], async (req, res, next) => {
    const { parentId } = req.params;
    const { name } = req.body;
    const { id: userId } = req.user;
    const validation = validationResult(req);
    if (!validation.isEmpty()) {
        return res.status(400).json({ errors: validation.array() });
    }
    try {
        const parentFolder = await prisma.folder.findFirst({
            where: {
                id: parseInt(parentId),
                userId: userId
            }
        })
        if (!parentFolder) {
            throw new CustomNotFoundError("Parent Folder Not Found")
        }
    }
    catch (err) {
        return next(err)
    }
    try {
        await prisma.folder.create({
            data: {
                name: name,
                parentId: parseInt(parentId),
                userId: userId
            }
        })
    }
    catch (err) {
        return next(err)
    }
    res.redirect(`/${parentId}`);
})

indexRouter.get("/delete/folder/:folderId", async (req, res, next) => {
    const { folderId } = req.params;
    const { id } = req.user;
    try {
        const folder = await prisma.folder.findFirst({
            where: {
                id: parseInt(folderId)
            }
        });
        if (!folder || folder.userId !== id) {
            throw new CustomNotFoundError("Folder Not Found")
        }
        await prisma.folder.delete({
            where: {
                id: parseInt(folderId)
            }
        })

        res.redirect(`/${folder.parentId ? folder.parentId : "home"}`);
    }
    catch (err) {
        return next(err)
    }
})

indexRouter.get("/update-folder/:folderId", async (req, res, next) => {
    const { folderId } = req.params;
    const { id: userId } = req.user;
    try {
        const folder = await prisma.folder.findFirst({
            where: {
                id: parseInt(folderId),
                userId: userId
            }
        })
        if (!folder) {
            throw new CustomNotFoundError("Folder Not Found")
        }
        res.render("updateFolderForm", {
            folderId: folderId
        });
    }
    catch (err) {
        return next(err)
    }
});

indexRouter.post('/update-folder/:folderId', [
    body("name").escape().trim().isLength({ min: 1 }).withMessage("Folder name is required")
], async (req, res, next) => {
    const { folderId } = req.params;
    const { name } = req.body;
    const { id: userId } = req.user;
    const validation = validationResult(req);
    if (!validation.isEmpty()) {
        return res.status(400).json({ errors: validation.array() });
    }
    try {
        const folder = await prisma.folder.findFirst({
            where: {
                id: parseInt(folderId),
                userId: userId
            }
        })
        if (!folder) {
            throw new CustomNotFoundError("Folder Not Found")
        }
    }
    catch (err) {
        return next(err)
    }
    try {
        const folder = await prisma.folder.update({
            where: {
                id: parseInt(folderId)
            },
            data: {
                name: name
            },
            select: {
                parentId: true
            }
        })
        res.redirect(`/${folder.parentId}`);
    }
    catch (err) {
        return next(err)
    }
})
export default indexRouter;