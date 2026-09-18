import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { SearchResponse, SearchType } from '../interfaces/search';

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  private http = inject(HttpClient);

  public search(query: string, type: SearchType, maxResults = 15): Observable<SearchResponse> {
    const params = new HttpParams()
      .set('q', query)
      .set('type', type)
      .set('max', String(maxResults));
    return this.http.get<SearchResponse>('search', { params }).pipe(
      catchError((error: HttpErrorResponse) => of<SearchResponse>({
        status: 'error',
        msg: error.error instanceof ErrorEvent
          ? error.error.message
          : (typeof error.error === 'string'
            ? error.error
            : (error.error?.msg || error.message || 'Search request failed')),
        query,
        type,
        results: [],
      }))
    );
  }

  public trending(maxResults = 15): Observable<SearchResponse> {
    const params = new HttpParams().set('max', String(maxResults));
    return this.http.get<SearchResponse>('trending', { params }).pipe(
      catchError((error: HttpErrorResponse) => of<SearchResponse>({
        status: 'error',
        msg: error.error instanceof ErrorEvent
          ? error.error.message
          : (typeof error.error === 'string'
            ? error.error
            : (error.error?.msg || error.message || 'Trending request failed')),
        query: '',
        type: 'video',
        results: [],
      }))
    );
  }
}
