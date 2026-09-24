import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filterLowStock',
  standalone: true
})
export class FilterLowStockPipe implements PipeTransform {
  transform(products: any[]): any[] {
    if (!Array.isArray(products)) return [];
    return products.filter(p => (Number(p.stock) || 0) <= 5);
  }
}
