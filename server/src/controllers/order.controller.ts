import type { RequestHandler } from 'express';
import type { ChangeStatusInput, CreateOrderInput, QuoteRequest } from '@burger/shared';
import { orderService } from '../services/order.service';

const params = (req: Parameters<RequestHandler>[0]) => req.valid.params as { id: string };

// Los datos de pedidos son personales: nunca cachear.
const NO_STORE = 'no-store';

export const orderController = {
  quote: (async (req, res) => {
    const quote = await orderService.quote(req.valid.body as QuoteRequest);
    res.set('Cache-Control', NO_STORE).json(quote);
  }) satisfies RequestHandler,

  create: (async (req, res) => {
    const order = await orderService.create(req.valid.body as CreateOrderInput, req.user!, req.log);
    res.set('Cache-Control', NO_STORE).status(201).location(`/api/orders/${order.id}`).json(order);
  }) satisfies RequestHandler,

  listMine: (async (req, res) => {
    res.set('Cache-Control', NO_STORE).json(await orderService.listMine(req.user!));
  }) satisfies RequestHandler,

  getById: (async (req, res) => {
    res.set('Cache-Control', NO_STORE).json(await orderService.getById(params(req).id, req.user!));
  }) satisfies RequestHandler,

  cancel: (async (req, res) => {
    res.set('Cache-Control', NO_STORE).json(await orderService.cancel(params(req).id, req.user!));
  }) satisfies RequestHandler,

  changeStatus: (async (req, res) => {
    const { status, note } = req.valid.body as ChangeStatusInput;
    const order = await orderService.changeStatus(params(req).id, status, req.user!, note);
    res.set('Cache-Control', NO_STORE).json(order);
  }) satisfies RequestHandler,
};
