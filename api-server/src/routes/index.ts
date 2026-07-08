import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import storageRouter from "./storage";
import collectionRouter from "./collection";
import cardsRouter from "./cards";
import sealedProductsRouter from "./sealedProducts";
import imagesRouter from "./images";
import dashboardRouter from "./dashboard";
import listingRouter from "./listing";
import expensesRouter from "./expenses";
import customersRouter from "./customers";
import pickupsRouter from "./pickups";
import exportDataRouter from "./exportData";
import trashRouter from "./trash";
import backupRouter from "./backup";
import marketRouter from "./market";
import analyticsRouter from "./analytics";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(storageRouter);
router.use(collectionRouter);   // must precede cardsRouter so /cards/duplicates isn't swallowed by /cards/:id
router.use(cardsRouter);
router.use(sealedProductsRouter);
router.use(imagesRouter);
router.use(dashboardRouter);
router.use(listingRouter);
router.use(expensesRouter);
router.use(customersRouter);
router.use(pickupsRouter);
router.use(exportDataRouter);
router.use(trashRouter);
router.use(backupRouter);
router.use(marketRouter);
router.use(analyticsRouter);

export default router;
